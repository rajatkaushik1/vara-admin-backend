// C:\Users\Dell\Desktop\vara-admin\routes\songRoutes.js
const express = require('express');
const router = express.Router();
const { uploadSong, getAllSongs, deleteSong, updateSong } = require('../controllers/songController'); // Import updateSong
const upload = require('../middleware/uploadMiddleware'); // Corrected filename

// Upload a new song (using Multer middleware)
router.post('/', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), uploadSong);

// Get all songs
router.get('/', getAllSongs);

// Delete a song by ID
router.delete('/:id', deleteSong);

// NEW: Update a song by ID (also uses Multer for potential file uploads)
router.put('/:id', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), updateSong); // Define the PUT route for updating

module.exports = router;