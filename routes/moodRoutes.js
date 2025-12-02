const express = require('express');
const router = express.Router();

const {
  createMood,
  getAllMoods,
  updateMood,
  deleteMood
} = require('../controllers/moodController');

const { uploadImageToCloudinary } = require('../middleware/uploadMiddleware');
const cache = require('../middleware/cache');
const cacheControl = require('../middleware/cacheControl');

/**
 * Moods API
 * - Image field: moodImage (optional)
 * - Stored on Cloudinary via uploadMiddleware
 */

// Create a new mood (multipart: name, description?, moodImage?)
router.post(
  '/',
  uploadImageToCloudinary.fields([{ name: 'moodImage', maxCount: 1 }]),
  createMood
);

// Get all moods (cached)
router.get('/', cacheControl(600), cache(300), getAllMoods);

// Update a mood (multipart: name?, description?, moodImage?; clearImage='true' supported)
router.put(
  '/:id',
  uploadImageToCloudinary.fields([{ name: 'moodImage', maxCount: 1 }]),
  updateMood
);

// Delete a mood
router.delete('/:id', deleteMood);

module.exports = router;
