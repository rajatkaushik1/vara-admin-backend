const Instrument = require('../models/Instrument');
const cloudinary = require('cloudinary').v2;

/**
 * Extract Cloudinary public_id from a URL produced by multer-storage-cloudinary
 * Example: https://res.cloudinary.com/<cloud>/image/upload/v1700000000/vara-music-instruments/instrumentImage-1700000000000.png
 * Returns: vara-music-instruments/instrumentImage-1700000000000
 */
const getPublicIdFromCloudinaryUrl = (url) => {
  try {
    if (!url) return null;
    const u = new URL(url);
    // Find '/upload/' segment and take the path after it (strip extension)
    const parts = u.pathname.split('/upload/');
    if (parts.length < 2) return null;
    const pathAfterUpload = parts[1]; // e.g. v12345/vara-music-instruments/instrumentImage-...
    // Remove the leading version (v12345/) and then strip extension
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};

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
      imageUrl: imageFile ? imageFile.path : ''
    });

    await instrument.save();
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
      // Delete old image if present
      if (existing.imageUrl) {
        const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (e) {
            console.warn('Failed to delete previous instrument image:', e.message || e);
          }
        }
      }
      newImageUrl = imageFile.path;
    } else if (String(clearImage).toLowerCase() === 'true') {
      if (existing.imageUrl) {
        const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (e) {
            console.warn('Failed to delete instrument image on clear request:', e.message || e);
          }
        }
      }
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

    // Delete Cloudinary image if present
    if (existing.imageUrl) {
      const publicId = getPublicIdFromCloudinaryUrl(existing.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (e) {
          console.warn('Failed to delete instrument image during delete:', e.message || e);
        }
      }
    }

    await existing.deleteOne();
    return res.status(200).json({ success: true, message: 'Instrument and its image deleted successfully.' });
  } catch (error) {
    console.error('Error deleting instrument:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
