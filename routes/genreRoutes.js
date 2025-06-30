// C:\Users\Dell\Desktop\vara-admin\routes\genreRoutes.js
const express = require('express');
const router = express.Router();
// Import all necessary functions from controller
const { createGenre, getAllGenres, deleteGenre, updateGenre } = require('../controllers/genreController');

// Create a new genre
router.post('/', createGenre);

// Get all genres
router.get('/', getAllGenres);

// Delete a genre
router.delete('/:id', deleteGenre);

// NEW: Update a genre by ID
router.put('/:id', updateGenre); // Define the PUT route for updating

module.exports = router;