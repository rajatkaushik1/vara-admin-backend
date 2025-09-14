const Mood = require('../models/Mood');
const cloudinary = require('cloudinary').v2;
const { bump } = require('../utils/contentVersion');

/**
 * Extract Cloudinary public_id from a URL produced by multer-storage-cloudinary.
 * Example:
 *   https://res.cloudinary.com/<cloud>/image/upload/v1700000000/vara-music-moods/moodImage-1700000000000.png
 * Returns:
 *   vara-music-moods/moodImage-1700000000000
 */
function getPublicIdFromCloudinaryUrl(url) {
  try {
    if (!url) return null;
    const u = new URL(url);
    const parts = u.pathname.split('/upload/');
    if (parts.length < 2) return null;
    const pathAfterUpload = parts[1]; // e.g. v12345/vara-music-moods/moodImage-...
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^/.]+$/, ''); // strip extension
  } catch {
    return null;
  }
}

// CREATE: POST /api/moods
// Fields: name (required), description (optional)
// Files: moodImage (optional)
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
      imageUrl: imageFile ? imageFile.path : ''
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
      // Delete old image if present
      if (existing.imageUrl) {
        const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
        if (publicId) {
          try { await cloudinary.uploader.destroy(publicId); } catch (e) {
            console.warn('Failed to delete previous mood image:', e.message || e);
          }
        }
      }
      newImageUrl = imageFile.path;
    } else if (String(clearImage).toLowerCase() === 'true') {
      if (existing.imageUrl) {
        const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
        if (publicId) {
          try { await cloudinary.uploader.destroy(publicId); } catch (e) {
            console.warn('Failed to delete mood image on clear request:', e.message || e);
          }
        }
      }
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

    // Delete Cloudinary image if present
    if (existing.imageUrl) {
      const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
      if (publicId) {
        try { await cloudinary.uploader.destroy(publicId); } catch (e) {
          console.warn('Failed to delete mood image during delete:', e.message || e);
        }
      }
    }

    await existing.deleteOne();
    try { await bump('moods'); } catch (e) { console.warn('content version bump failed (deleteMood):', e?.message || e); }

    return res.status(200).json({ success: true, message: 'Mood and its image deleted successfully.' });
  } catch (error) {
    console.error('Error deleting mood:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
