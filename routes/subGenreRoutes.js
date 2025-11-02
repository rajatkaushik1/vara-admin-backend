// C:\Users\Dell\Desktop\vara-admin\routes\subGenreRoutes.js
    const express = require('express');
    const router = express.Router();
    // Import all necessary functions from controller
    const { createSubGenre, getSubGenresByGenre, getAllSubGenres, deleteSubGenre, updateSubGenre } = require('../controllers/subGenreController');
    const { uploadImageToCloudinary } = require('../middleware/uploadMiddleware');
    const cache = require('../middleware/cache');             // <-- add
    const cacheControl = require('../middleware/cacheControl'); // <-- add

    // Create a new sub-genre (now accepts an image file)
    // Use upload.fields() to handle the 'subGenreImage' file input
    router.post('/', uploadImageToCloudinary.fields([{ name: 'subGenreImage', maxCount: 1 }]), createSubGenre);

    // Get sub-genres by parent genre ID (no change needed here)
    router.get('/byGenre/:genreId', cacheControl(600), cache(300), getSubGenresByGenre); // <-- updated

    // Get all sub-genres
    router.get('/', cacheControl(600), cache(300), getAllSubGenres); // <-- updated

    // Delete a sub-genre by ID
    router.delete('/:id', deleteSubGenre);

    // Update a sub-genre by ID (now accepts an image file)
    // Use upload.fields() to handle the 'subGenreImage' file input
    router.put('/:id', uploadImageToCloudinary.fields([{ name: 'subGenreImage', maxCount: 1 }]), updateSubGenre);

    module.exports = router;
