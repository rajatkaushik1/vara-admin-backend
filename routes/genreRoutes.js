    // C:\Users\Dell\Desktop\vara-admin\routes\genreRoutes.js
    const express = require('express');
    const router = express.Router();
    // Import all necessary functions from controller
    const { createGenre, getAllGenres, deleteGenre, updateGenre } = require('../controllers/genreController');
    const upload = require('../middleware/uploadMiddleware'); // ADDED: Import the upload middleware

    // Create a new genre (now accepts an image file)
    // Use upload.fields() to handle the 'genreImage' file input
    router.post('/', upload.fields([{ name: 'genreImage', maxCount: 1 }]), createGenre);

    // Get all genres
    router.get('/', getAllGenres);

    // Delete a genre
    router.delete('/:id', deleteGenre);

    // Update a genre by ID (now accepts an image file)
    // Use upload.fields() to handle the 'genreImage' file input
    router.put('/:id', upload.fields([{ name: 'genreImage', maxCount: 1 }]), updateGenre);

    module.exports = router;
    