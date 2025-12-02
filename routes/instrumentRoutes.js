const express = require('express');
const router = express.Router();

const {
  createInstrument,
  getAllInstruments,
  updateInstrument,
  deleteInstrument
} = require('../controllers/instrumentController');

const { uploadImageToCloudinary } = require('../middleware/uploadMiddleware');
const cache = require('../middleware/cache');
const cacheControl = require('../middleware/cacheControl');

/**
 * Instruments API
 * - Image field: instrumentImage (optional)
 * - Stored in Cloudinary folder: vara-music-instruments (handled by uploadMiddleware)
 */

// Create a new instrument (multipart: name, description?, instrumentImage?)
router.post(
  '/',
  uploadImageToCloudinary.fields([{ name: 'instrumentImage', maxCount: 1 }]),
  createInstrument
);

// Get all instruments
router.get('/', cacheControl(600), cache(300), getAllInstruments);

// Optional: single instrument read (cached if exists)
// router.get('/:id', cacheControl(600), cache(300), getInstrumentById);

// Update an instrument (multipart: name?, description?, instrumentImage?; clearImage='true' supported)
router.put(
  '/:id',
  uploadImageToCloudinary.fields([{ name: 'instrumentImage', maxCount: 1 }]),
  updateInstrument
);

// Delete an instrument
router.delete('/:id', deleteInstrument);

module.exports = router;
