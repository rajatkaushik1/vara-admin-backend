const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre'); // Needed for deletion cascade
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

// Derive the R2 object key from a public URL (supports both CDN base and direct endpoint)
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

async function deleteR2KeyIfExists(key, ctx='genre') {
  if (!key) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    console.warn(`R2 delete warning (${ctx}):`, e && e.message ? e.message : String(e));
  }
}

// Always resolve a public image URL from the uploaded file object using key (never use file.location)
function resolveImageUrlFromFile(file) {
  if (!file) return '';
  if (file.key) return buildPublicUrlFromKey(file.key);
  return '';
}

// @desc    Create a new genre
// @route   POST /api/genres
// @access  Private (Admin)
exports.createGenre = async (req, res) => {
  const { name, description } = req.body;
  const imageFile =
    (req.files && req.files.genreImage && req.files.genreImage[0]) ||
    req.file ||
    null;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Genre name is required.' });
  }

  try {
    const genreExists = await Genre.findOne({ name });
    if (genreExists) {
      return res.status(409).json({ success: false, error: 'Genre with this name already exists.' });
    }

    const genre = new Genre({
      name,
      description: description || '',
      imageUrl: resolveImageUrlFromFile(imageFile)
    });

    await genre.save();
    try { await bump('genres'); } catch (e) { console.warn('content version bump failed (createGenre):', e?.message || e); }
    res.status(201).json(genre);
  } catch (error) {
    console.error("Error creating genre:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all genres
// @route   GET /api/genres
// @access  Public
exports.getAllGenres = async (req, res) => {
  try {
    const genres = await Genre.find({});
    res.json(genres);
  } catch (error) {
    console.error("Error fetching genres:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update a genre by ID
// @route   PUT /api/genres/:id
// @access  Private (Admin)
exports.updateGenre = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const imageFile =
    (req.files && req.files.genreImage && req.files.genreImage[0]) ||
    req.file ||
    null;

  try {
    const existingGenre = await Genre.findById(id);
    if (!existingGenre) {
      return res.status(404).json({ success: false, error: 'Genre not found.' });
    }

    // Unique name check (excluding current)
    if (name && name !== existingGenre.name) {
      const nameExists = await Genre.findOne({ name });
      if (nameExists) {
        return res.status(409).json({ success: false, error: 'Another genre with this name already exists.' });
      }
    }

    let newImageUrl = existingGenre.imageUrl;

    if (imageFile) {
      // Replace: delete old R2 image if derivable
      const oldKey = r2KeyFromUrl(existingGenre.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey, 'genre/update');
      newImageUrl = resolveImageUrlFromFile(imageFile);
    } else if (req.body.clearImage === 'true') {
      const oldKey = r2KeyFromUrl(existingGenre.imageUrl);
      if (oldKey) await deleteR2KeyIfExists(oldKey, 'genre/clear');
      newImageUrl = '';
    }

    const updatedGenre = await Genre.findByIdAndUpdate(
      id,
      {
        name: name || existingGenre.name,
        description: description !== undefined ? description : existingGenre.description,
        imageUrl: newImageUrl
      },
      { new: true, runValidators: true }
    );

    if (!updatedGenre) {
      return res.status(404).json({ success: false, error: 'Genre not found after update attempt.' });
    }

    try { await bump('genres'); } catch (e) { console.warn('content version bump failed (updateGenre):', e?.message || e); }
    res.status(200).json(updatedGenre);
  } catch (error) {
    console.error("Error updating genre:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete a genre (and its image and associated sub-genre images)
// @route   DELETE /api/genres/:id
// @access  Private (Admin)
exports.deleteGenre = async (req, res) => {
  try {
    const { id } = req.params;

    const genreToDelete = await Genre.findById(id);
    if (!genreToDelete) {
      return res.status(404).json({ success: false, error: 'Genre not found.' });
    }

    // Delete associated sub-genres' images first (avoid orphan files)
    const subGenres = await SubGenre.find({ genre: id }).select('_id imageUrl').lean();
    const sgKeys = subGenres
      .map(sg => r2KeyFromUrl(sg.imageUrl))
      .filter(Boolean);

    if (sgKeys.length) {
      await Promise.all(
        sgKeys.map(k => deleteR2KeyIfExists(k, 'subgenre/cascade'))
      );
    }

    // Delete sub-genre documents
    const deleteSubGenresResult = await SubGenre.deleteMany({ genre: id });
    console.log(`Deleted ${deleteSubGenresResult.deletedCount} sub-genres for genre ID: ${id}`);

    // Delete genre image from R2
    const gKey = r2KeyFromUrl(genreToDelete.imageUrl);
    if (gKey) await deleteR2KeyIfExists(gKey, 'genre/delete');

    // Delete genre document
    const deletedGenre = await Genre.findByIdAndDelete(id);
    if (!deletedGenre) {
      return res.status(404).json({ success: false, error: 'Genre not found.' });
    }

    try { await bump('genres'); } catch (e) { console.warn('content version bump failed (deleteGenre):', e?.message || e); }
    res.status(200).json({ success: true, message: 'Genre, its image, and associated sub-genres (with images) deleted successfully.' });
  } catch (error) {
    console.error("Error deleting genre and its sub-genres:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
