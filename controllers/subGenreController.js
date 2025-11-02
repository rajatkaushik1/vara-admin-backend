const SubGenre = require('../models/SubGenre');
const Genre = require('../models/Genre');
const { bump } = require('../utils/contentVersion');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// --- R2 config/helpers ---
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
  return `https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

function r2KeyFromUrl(url) {
  try {
    if (!url) return null;
    if (R2_PUBLIC && url.startsWith(R2_PUBLIC)) {
      const key = url.slice(R2_PUBLIC.length).replace(/^\/+/, '');
      return key || null;
    }
    const u = new URL(url);
    let p = u.pathname.replace(/^\/+/, '');
    if (p.startsWith(R2_BUCKET + '/')) p = p.slice(R2_BUCKET.length + 1);
    return p || null;
  } catch {
    return null;
  }
}

async function deleteR2KeyIfExists(key, ctx='subgenre') {
  if (!key) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    console.warn(`R2 delete warning (${ctx}):`, e && e.message ? e.message : String(e));
  }
}

function resolveImageUrlFromFile(file) {
  if (!file) return '';
  if (file.key) return buildPublicUrlFromKey(file.key); // always use public base
  return '';
}

// @desc    Create a new sub-genre
// @route   POST /api/subgenres
// @access  Private (Admin)
exports.createSubGenre = async (req, res) => {
  const { name, genre, description } = req.body;
  const imageFile =
    (req.files && req.files.subGenreImage && req.files.subGenreImage[0]) ||
    req.file ||
    null;

  if (!name || !genre) {
    return res.status(400).json({ success: false, error: 'Sub-genre name and parent genre are required.' });
  }

  try {
    const parentGenre = await Genre.findById(genre);
    if (!parentGenre) {
      return res.status(404).json({ success: false, error: 'Parent genre not found.' });
    }

    const subGenreExists = await SubGenre.findOne({ name, genre });
    if (subGenreExists) {
      return res.status(409).json({ success: false, error: 'Sub-genre with this name already exists under the selected genre.' });
    }

    const subGenre = new SubGenre({
      name,
      genre,
      description: description || '',
      imageUrl: resolveImageUrlFromFile(imageFile)
    });

    await subGenre.save();
    try { await bump('subgenres'); } catch (e) { console.warn('content version bump failed (createSubGenre):', e?.message || e); }

    const populated = await SubGenre.findById(subGenre._id).populate('genre', 'name');
    return res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating sub-genre:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all sub-genres
// @route   GET /api/subgenres
// @access  Public
exports.getAllSubGenres = async (req, res) => {
  try {
    const subGenres = await SubGenre.find({})
      .populate('genre', 'name')
      .lean();
  return res.json(subGenres);
  } catch (error) {
    console.error("Error fetching sub-genres:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get sub-genres by parent genre ID
// @route   GET /api/subgenres/byGenre/:genreId
// @access  Public
exports.getSubGenresByGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const subGenres = await SubGenre.find({ genre: genreId })
      .populate('genre', 'name')
      .lean();
    res.json(subGenres);
  } catch (error) {
    console.error("Error fetching sub-genres by genre ID:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update a sub-genre by ID
// @route   PUT /api/subgenres/:id
// @access  Private (Admin)
exports.updateSubGenre = async (req, res) => {
  const { id } = req.params;
  const { name, genre, description } = req.body;
  const imageFile =
    (req.files && req.files.subGenreImage && req.files.subGenreImage[0]) ||
    req.file ||
    null;

  try {
    const existingSubGenre = await SubGenre.findById(id);
    if (!existingSubGenre) {
      return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
    }

    if (genre && genre !== existingSubGenre.genre.toString()) {
      const parentGenre = await Genre.findById(genre);
      if (!parentGenre) {
        return res.status(404).json({ success: false, error: 'New parent genre not found.' });
      }
    }

    if (name && name !== existingSubGenre.name || (genre && genre !== existingSubGenre.genre.toString())) {
      const nameExists = await SubGenre.findOne({ name: name || existingSubGenre.name, genre: genre || existingSubGenre.genre });
      if (nameExists && nameExists._id.toString() !== id) {
        return res.status(409).json({ success: false, error: 'Another sub-genre with this name already exists under the selected genre.' });
      }
    }

    let newImageUrl = existingSubGenre.imageUrl;

    if (imageFile) {
      const oldKey = r2KeyFromUrl(existingSubGenre.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey, 'subgenre/update');
      newImageUrl = resolveImageUrlFromFile(imageFile);
    } else if (req.body.clearImage === 'true') {
      const oldKey = r2KeyFromUrl(existingSubGenre.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey, 'subgenre/clear');
      newImageUrl = '';
    }

    const updatedSubGenre = await SubGenre.findByIdAndUpdate(
      id,
      {
        name: name || existingSubGenre.name,
        genre: genre || existingSubGenre.genre,
        description: description !== undefined ? description : existingSubGenre.description,
        imageUrl: newImageUrl
      },
      { new: true, runValidators: true }
    ).populate('genre', 'name');

    if (!updatedSubGenre) {
      return res.status(404).json({ success: false, error: 'Sub-genre not found after update attempt.' });
    }

    try { await bump('subgenres'); } catch (e) { console.warn('content version bump failed (updateSubGenre):', e?.message || e); }
    res.status(200).json(updatedSubGenre);
  } catch (error) {
    console.error("Error updating sub-genre:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete a sub-genre
// @route   DELETE /api/subgenres/:id
// @access  Private (Admin)
exports.deleteSubGenre = async (req, res) => {
  try {
    const { id } = req.params;

    const subGenreToDelete = await SubGenre.findById(id);
    if (!subGenreToDelete) {
      return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
    }

    // Delete image from R2 (best-effort)
    const key = r2KeyFromUrl(subGenreToDelete.imageUrl);
    if (key) await deleteR2KeyIfExists(key, 'subgenre/delete');

    const deletedSubGenre = await SubGenre.findByIdAndDelete(id);

    if (!deletedSubGenre) {
      return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
    }

    try { await bump('subgenres'); } catch (e) { console.warn('content version bump failed (deleteSubGenre):', e?.message || e); }
    res.status(200).json({ success: true, message: 'Sub-genre and its image deleted successfully.' });
  } catch (error) {
    console.error("Error deleting sub-genre:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
