// C:\Users\Dell\Desktop\vara-admin\routes\subGenreRoutes.js
const express = require('express');
const router = express.Router();
// Import all necessary functions from controller
const { createSubGenre, getSubGenresByGenre, getAllSubGenres, deleteSubGenre, updateSubGenre } = require('../controllers/subGenreController'); // Import updateSubGenre

// Create a new sub-genre
router.post('/', createSubGenre);

// Get sub-genres by parent genre ID
router.get('/byGenre/:genreId', getSubGenresByGenre);

// Get all sub-genres
router.get('/', getAllSubGenres);

// Delete a sub-genre by ID
router.delete('/:id', deleteSubGenre);

// NEW: Update a sub-genre by ID
router.put('/:id', updateSubGenre); // Define the PUT route for updating

module.exports = router;