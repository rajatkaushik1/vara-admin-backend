// C:\Users\Dell\Desktop\vara-admin\controllers\songController.js
const Song = require('../models/Song');
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre');
const cloudinary = require('cloudinary').v2;

// Function to extract public ID from Cloudinary URL (helper for delete/update)
const getPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex > -1 && parts[uploadIndex + 1]) {
        const publicIdWithVersion = parts.slice(uploadIndex + 1).join('/');
        // Remove version number (e.g., 'v123456789/') and extension
        const finalId = publicIdWithVersion.split('/').slice(1).join('/').split('.')[0];
        return finalId;
    }
    return null;
};


// Upload a new song
exports.uploadSong = async (req, res) => {
    // CHANGED: Removed 'isExclusive' from destructuring
    const { title, genres, subGenres, collectionType } = req.body;

    const audioFile = req.files && req.files.audioFile && req.files.audioFile.length > 0 ? req.files.audioFile[0] : null;
    const imageFile = req.files && req.files.imageFile && req.files.imageFile.length > 0 ? req.files.imageFile[0] : null;

    if (!audioFile || !imageFile) {
        return res.status(400).json({ success: false, error: 'Both image and audio files are required.' });
    }

    try {
        const genrePromises = Array.isArray(genres) ? genres.map(id => Genre.findById(id)) : [];
        const subGenrePromises = Array.isArray(subGenres) ? subGenres.map(id => SubGenre.findById(id)) : [];

        const existingGenres = await Promise.all(genrePromises);
        const existingSubGenres = await Promise.all(subGenrePromises);

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid.' });
        }

        const song = new Song({
            title,
            imageUrl: imageFile.path,
            audioUrl: audioFile.path,
            genres,
            subGenres,
            // REMOVED: isExclusive field assignment
            collectionType
        });

        await song.save();
        res.status(201).json(song);
    } catch (error) {
        console.error("Error uploading song:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all songs
exports.getAllSongs = async (req, res) => {
    try {
        // Populate genres and subGenres as before
        const songs = await Song.find()
            .populate('genres', 'name')
            .populate('subGenres', 'name');
        res.json(songs);
    } catch (error) {
        console.error("Error fetching all songs:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a song by ID (including associated files from Cloudinary)
exports.deleteSong = async (req, res) => {
    try {
        const { id } = req.params;
        const songToDelete = await Song.findById(id);

        if (!songToDelete) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        // Delete image from Cloudinary
        if (songToDelete.imageUrl) {
            const publicId = getPublicIdFromCloudinaryUrl(songToDelete.imageUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, (error, result) => {
                    if (error) console.error("Failed to delete image from Cloudinary:", error);
                    else console.log("Cloudinary image deletion result:", result);
                });
            } else {
                console.warn("Could not extract public ID from imageUrl:", songToDelete.imageUrl);
            }
        }

        // Delete audio from Cloudinary (resource_type: 'raw' for audio/video)
        if (songToDelete.audioUrl) {
            const publicId = getPublicIdFromCloudinaryUrl(songToDelete.audioUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }, (error, result) => {
                    if (error) console.error("Failed to delete audio from Cloudinary:", error);
                    else console.log("Cloudinary audio deletion result:", result);
                });
            } else {
                console.warn("Could not extract public ID from audioUrl:", songToDelete.audioUrl);
            }
        }

        await Song.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: 'Song and associated files deleted successfully from Cloudinary and DB.' });
    } catch (error) {
        console.error("Error deleting song and its files:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a song by ID (handles file re-uploads to Cloudinary)
exports.updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        // CHANGED: Removed 'isExclusive' from destructuring
        const { title, genres, subGenres, collectionType } = req.body;

        const existingSong = await Song.findById(id);
        if (!existingSong) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        let newImageUrl = existingSong.imageUrl;
        let newAudioUrl = existingSong.audioUrl;

        // Handle new image upload
        if (req.files && req.files.imageFile && req.files.imageFile.length > 0) {
            // Delete old image from Cloudinary if it exists
            if (existingSong.imageUrl) {
                const oldPublicId = getPublicIdFromCloudinaryUrl(existingSong.imageUrl);
                if (oldPublicId) {
                    await cloudinary.uploader.destroy(oldPublicId, (error, result) => {
                        if (error) console.error("Failed to delete old image from Cloudinary:", error);
                        else console.log("Cloudinary old image deletion result:", result);
                    });
                }
            }
            newImageUrl = req.files.imageFile[0].path; // Set new Cloudinary URL
        }

        // Handle new audio upload
        if (req.files && req.files.audioFile && req.files.audioFile.length > 0) {
            // Delete old audio from Cloudinary if it exists
            if (existingSong.audioUrl) {
                const oldPublicId = getPublicIdFromCloudinaryUrl(existingSong.audioUrl);
                if (oldPublicId) {
                    await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'raw' }, (error, result) => {
                        if (error) console.error("Failed to delete old audio from Cloudinary:", error);
                        else console.log("Cloudinary old audio deletion result:", result);
                    });
                }
            }
            newAudioUrl = req.files.audioFile[0].path; // Set new Cloudinary URL
        }

        // Validate Genre and SubGenre IDs for update
        const genrePromises = Array.isArray(genres) ? genres.map(id => Genre.findById(id)) : [];
        const subGenrePromises = Array.isArray(subGenres) ? subGenres.map(id => SubGenre.findById(id)) : [];

        const existingGenres = await Promise.all(genrePromises);
        const existingSubGenres = await Promise.all(subGenrePromises);

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid for update.' });
        }

        const updatedSong = await Song.findByIdAndUpdate(
            id,
            {
                title,
                imageUrl: newImageUrl,
                audioUrl: newAudioUrl,
                genres: genres,
                subGenres: subGenres,
                // REMOVED: isExclusive field assignment
                collectionType
            },
            { new: true, runValidators: true }
        ).populate('genres', 'name').populate('subGenres', 'name');

        if (!updatedSong) {
            return res.status(404).json({ success: false, error: 'Song not found after update attempt.' });
        }

        res.status(200).json(updatedSong);
    } catch (error) {
        console.error("Error updating song:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    uploadSong: exports.uploadSong,
    getAllSongs: exports.getAllSongs,
    deleteSong: exports.deleteSong,
    updateSong: exports.updateSong,
};
