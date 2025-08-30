const express = require('express');
const router = express.Router();

const {
  createInstrument,
  getAllInstruments,
  updateInstrument,
  deleteInstrument
} = require('../controllers/instrumentController');

const upload = require('../middleware/uploadMiddleware');

/**
 * Instruments API
 * - Image field: instrumentImage (optional)
 * - Stored in Cloudinary folder: vara-music-instruments (handled by uploadMiddleware)
 */

// Create a new instrument (multipart: name, description?, instrumentImage?)
router.post(
  '/',
  upload.fields([{ name: 'instrumentImage', maxCount: 1 }]),
  createInstrument
);

// Get all instruments
router.get('/', getAllInstruments);

// Update an instrument (multipart: name?, description?, instrumentImage?; clearImage='true' supported)
router.put(
  '/:id',
  upload.fields([{ name: 'instrumentImage', maxCount: 1 }]),
  updateInstrument
);

// Delete an instrument
router.delete('/:id', deleteInstrument);

module.exports = router;
