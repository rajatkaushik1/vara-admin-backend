const Instrument = require('../models/Instrument');
const { bump } = require('../utils/contentVersion');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// --- R2 client/config helpers ---
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_PUBLIC = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function buildPublicUrlFromKey(key) {
  if (!key) return '';
  if (R2_PUBLIC) return `${R2_PUBLIC}/${key}`;
  // fallback to direct endpoint style (works but not CDN)
  return `https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

function r2KeyFromUrl(url) {
  try {
    if (!url) return null;
    if (R2_PUBLIC && url.startsWith(R2_PUBLIC)) {
      const key = url.slice(R2_PUBLIC.length).replace(/^\//, '');
      return key || null;
    }
    const u = new URL(url);
    // pathname like: /<bucket>/<key...>
    let p = u.pathname.replace(/^\//, ''); // strip leading slash
    if (p.startsWith(R2_BUCKET + '/')) p = p.slice(R2_BUCKET.length + 1);
    return p || null;
  } catch {
    return null;
  }
}

async function deleteR2KeyIfExists(key) {
  if (!key) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    // Best-effort: ignore not found or transient errors
    console.warn('R2 delete warning (instrument):', e && e.message ? e.message : String(e));
  }
}

// CREATE: POST /api/instruments
// Body: name (required), description (optional)
// File: instrumentImage (optional) via upload.fields
exports.createInstrument = async (req, res) => {
  try {
    const { name, description } = req.body;
    const imageFile =
      req.files && req.files.instrumentImage && req.files.instrumentImage.length > 0
        ? req.files.instrumentImage[0]
        : null;

    const rawName = (name || '').trim();
    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Instrument name is required.' });
    }

    // Case-insensitive duplicate check using collation
    const exists = await Instrument.findOne({ name: rawName })
      .collation({ locale: 'en', strength: 2 });
    if (exists) {
      return res.status(409).json({ success: false, error: `Instrument "${rawName}" already exists.` });
    }

    const instrument = new Instrument({
      name: rawName,
      description: description || '',
      imageUrl: imageFile ? buildPublicUrlFromKey(imageFile.key) : ''
    });

    await instrument.save();
    try { await bump('instruments'); } catch (e) { console.warn('content version bump failed (createInstrument):', e?.message || e); }
    return res.status(201).json(instrument);
  } catch (error) {
    console.error('Error creating instrument:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// READ: GET /api/instruments
exports.getAllInstruments = async (req, res) => {
  try {
    const items = await Instrument.find({}).sort({ name: 1 });
    return res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching instruments:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE: PUT /api/instruments/:id
// Accepts name, description, and optional instrumentImage; supports clearImage='true'
exports.updateInstrument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, clearImage } = req.body;
    const imageFile =
      req.files && req.files.instrumentImage && req.files.instrumentImage.length > 0
        ? req.files.instrumentImage[0]
        : null;

    const existing = await Instrument.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instrument not found.' });
    }

    // Unique name check (excluding current)
    if (name && name.trim() && name.trim() !== existing.name) {
      const normalized = name.trim();
      const conflict = await Instrument.findOne({ name: normalized, _id: { $ne: id } })
        .collation({ locale: 'en', strength: 2 });
      if (conflict) {
        return res.status(409).json({ success: false, error: `Another instrument with the name "${normalized}" already exists.` });
      }
    }

    let newImageUrl = existing.imageUrl;

    if (imageFile) {
      // Replace: delete old R2 key if derivable, then set new URL
      const oldKey = r2KeyFromUrl(existing.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey);
      newImageUrl = buildPublicUrlFromKey(imageFile.key);
    } else if (String(clearImage).toLowerCase() === 'true') {
      const oldKey = r2KeyFromUrl(existing.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey);
      newImageUrl = '';
    }

    const updated = await Instrument.findByIdAndUpdate(
      id,
      {
        name: name && name.trim() ? name.trim() : existing.name,
        description: typeof description !== 'undefined' ? description : existing.description,
        imageUrl: newImageUrl
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Instrument not found after update attempt.' });
    }

    try { await bump('instruments'); } catch (e) { console.warn('content version bump failed (updateInstrument):', e?.message || e); }
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating instrument:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE: DELETE /api/instruments/:id
exports.deleteInstrument = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Instrument.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instrument not found.' });
    }

    // Delete R2 image if present
    const key = r2KeyFromUrl(existing.imageUrl);
    if (key) await deleteR2KeyIfExists(key);

    await existing.deleteOne();
    try { await bump('instruments'); } catch (e) { console.warn('content version bump failed (deleteInstrument):', e?.message || e); }
    return res.status(200).json({ success: true, message: 'Instrument and its image deleted successfully.' });
  } catch (error) {
    console.error('Error deleting instrument:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
