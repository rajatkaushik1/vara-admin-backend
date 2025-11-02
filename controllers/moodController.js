const Mood = require('../models/Mood');
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
  // fallback to direct endpoint style (not preferred if you have a public base)
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
    // Best-effort: ignore not found or any transient errors
    console.warn('R2 delete warning (mood):', e && e.message ? e.message : String(e));
  }
}

// CREATE: POST /api/moods
// Fields: name (required), description (optional)
// Files: moodImage (optional) via upload.fields
exports.createMood = async (req, res) => {
  try {
    const { name, description } = req.body;
    const imageFile = req.files && req.files.moodImage && req.files.moodImage[0];

    const rawName = (name || '').trim();
    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Mood name is required.' });
    }

    // Case-insensitive uniqueness (collation)
    const exists = await Mood.findOne({ name: rawName }).collation({ locale: 'en', strength: 2 });
    if (exists) {
      return res.status(409).json({ success: false, error: `Mood "${rawName}" already exists.` });
    }

    const mood = new Mood({
      name: rawName,
      description: description || '',
      imageUrl: imageFile ? buildPublicUrlFromKey(imageFile.key) : ''
    });

    await mood.save();
    try { await bump('moods'); } catch (e) { console.warn('content version bump failed (createMood):', e?.message || e); }

    return res.status(201).json(mood);
  } catch (error) {
    console.error('Error creating mood:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// READ: GET /api/moods
exports.getAllMoods = async (req, res) => {
  try {
    const items = await Mood.find({}).sort({ name: 1 });
    return res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching moods:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE: PUT /api/moods/:id
// Accepts name, description and optional moodImage; supports clearImage='true'
exports.updateMood = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, clearImage } = req.body;
    const imageFile = req.files && req.files.moodImage && req.files.moodImage[0];

    const existing = await Mood.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Mood not found.' });
    }

    // Unique name check (excluding current)
    if (name && name.trim() && name.trim() !== existing.name) {
      const normalized = name.trim();
      const conflict = await Mood.findOne({ name: normalized, _id: { $ne: id } })
        .collation({ locale: 'en', strength: 2 });
      if (conflict) {
        return res.status(409).json({ success: false, error: `Another mood with the name "${normalized}" already exists.` });
      }
    }

    let newImageUrl = existing.imageUrl;

    if (imageFile) {
      // Replace: delete old R2 key if we can derive it, then set new URL
      const oldKey = r2KeyFromUrl(existing.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey);
      newImageUrl = buildPublicUrlFromKey(imageFile.key);
    } else if (String(clearImage).toLowerCase() === 'true') {
      const oldKey = r2KeyFromUrl(existing.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey);
      newImageUrl = '';
    }

    const updated = await Mood.findByIdAndUpdate(
      id,
      {
        name: name && name.trim() ? name.trim() : existing.name,
        description: typeof description !== 'undefined' ? description : existing.description,
        imageUrl: newImageUrl
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mood not found after update attempt.' });
    }

    try { await bump('moods'); } catch (e) { console.warn('content version bump failed (updateMood):', e?.message || e); }
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating mood:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE: DELETE /api/moods/:id
exports.deleteMood = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Mood.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Mood not found.' });
    }

    // Delete R2 image if present
    const key = r2KeyFromUrl(existing.imageUrl);
    if (key) await deleteR2KeyIfExists(key);

    await existing.deleteOne();
    try { await bump('moods'); } catch (e) { console.warn('content version bump failed (deleteMood):', e?.message || e); }

    return res.status(200).json({ success: true, message: 'Mood and its image deleted successfully.' });
  } catch (error) {
    console.error('Error deleting mood:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
