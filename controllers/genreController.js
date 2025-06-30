// C:\Users\Dell\Desktop\vara-admin\controllers\genreController.js
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre'); // Make sure this is still imported for cascading delete

// Create a new genre
exports.createGenre = async (req, res) => {
    try {
        const { name } = req.body;
        const newGenre = new Genre({ name });
        await newGenre.save();
        res.status(201).json(newGenre);
    } catch (error) {
        console.error("Error creating genre:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all genres
exports.getAllGenres = async (req, res) => {
    try {
        const genres = await Genre.find();
        res.status(200).json(genres);
    } catch (error) {
        console.error("Error fetching genres:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a genre by ID
exports.deleteGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const SubGenre = require('../models/SubGenre'); // Ensure this line is present here too, as it's used below
        const deletedSubGenresResult = await SubGenre.deleteMany({ genre: id });
        console.log(`Deleted ${deletedSubGenresResult.deletedCount} sub-genres associated with genre ID: ${id}`);
        const deletedGenre = await Genre.findByIdAndDelete(id);

        if (!deletedGenre) {
            return res.status(404).json({ success: false, error: 'Genre not found.' });
        }
        res.status(200).json({ success: true, message: 'Genre and its associated sub-genres deleted successfully.' });
    } catch (error) {
        console.error("Error deleting genre and its sub-genres:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// NEW: Update a genre by ID
exports.updateGenre = async (req, res) => {
    try {
        const { id } = req.params; // Get genre ID from URL parameters
        const { name } = req.body; // Get the new name from request body

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, error: 'Genre name cannot be empty.' });
        }

        // Find and update the genre. { new: true } returns the updated document.
        // { runValidators: true } ensures Mongoose schema validators run on update.
        const updatedGenre = await Genre.findByIdAndUpdate(
            id,
            { name: name },
            { new: true, runValidators: true }
        );

        if (!updatedGenre) {
            return res.status(404).json({ success: false, error: 'Genre not found.' });
        }

        res.status(200).json(updatedGenre);
    } catch (error) {
        console.error("Error updating genre:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};