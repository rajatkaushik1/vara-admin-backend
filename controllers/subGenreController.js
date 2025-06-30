// C:\Users\Dell\Desktop\vara-admin\controllers\subGenreController.js
const SubGenre = require('../models/SubGenre');
const Genre = require('../models/Genre'); // Ensure Genre model is imported

// Create a new sub-genre
const createSubGenre = async (req, res) => {
    try {
        // CHANGED: Expect 'genre' from req.body to match frontend
        const { name, genre } = req.body; 

        // Use 'genre' to find the existing genre
        const existingGenre = await Genre.findById(genre); 
        if (!existingGenre) {
            return res.status(404).json({ success: false, error: 'Parent genre not found.' });
        }

        const newSubGenre = new SubGenre({
            name,
            genre: genre // Use 'genre' here
        });
        await newSubGenre.save();
        res.status(201).json(newSubGenre);
    } catch (error) {
        console.error("Error creating sub-genre:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get sub-genres by parent genre ID
const getSubGenresByGenre = async (req, res) => {
    try {
        const { genreId } = req.params;
        const subGenres = await SubGenre.find({ genre: genreId }).populate('genre', 'name');
        res.status(200).json(subGenres);
    } catch (error) {
        console.error("Error fetching sub-genres by genre:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all sub-genres
const getAllSubGenres = async (req, res) => {
    try {
        const subGenres = await SubGenre.find().populate('genre', 'name');
        res.status(200).json(subGenres);
    } catch (error) {
        console.error("Error fetching all subgenres:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a sub-genre by ID
const deleteSubGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedSubGenre = await SubGenre.findByIdAndDelete(id);

        if (!deletedSubGenre) {
            return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
        }

        res.status(200).json({ success: true, message: 'Sub-genre deleted successfully.' });
    } catch (error) {
        console.error("Error deleting sub-genre:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// NEW: Update a sub-genre by ID
const updateSubGenre = async (req, res) => {
    try {
        const { id } = req.params;
        // CHANGED: Expect 'genre' from req.body to match frontend
        const { name, genre } = req.body; 

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, error: 'Sub-genre name cannot be empty.' });
        }
        // CHANGED: Check for 'genre' instead of 'genreId'
        if (!genre) { 
            return res.status(400).json({ success: false, error: 'Parent genre ID is required.' });
        }

        // Use 'genre' to find the existing genre
        const existingGenre = await Genre.findById(genre); 
        if (!existingGenre) {
            return res.status(404).json({ success: false, error: 'New parent genre not found.' });
        }

        // Update sub-genre, and populate the 'genre' field in the returned document
        const updatedSubGenre = await SubGenre.findByIdAndUpdate(
            id,
            { name: name, genre: genre }, // Use 'genre' here
            { new: true, runValidators: true }
        ).populate('genre', 'name'); // Populate to return the genre's name for frontend display

        if (!updatedSubGenre) {
            return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
        }

        res.status(200).json(updatedSubGenre);
    } catch (error) {
        console.error("Error updating sub-genre:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createSubGenre,
    getSubGenresByGenre,
    getAllSubGenres,
    deleteSubGenre,
    updateSubGenre, // Export the new function
};
