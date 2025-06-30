// C:\Users\Dell\Desktop\vara-admin\controllers\songController.js
const Song = require('../models/Song');
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre');
// Removed fs and path as local file operations are no longer needed
// const fs = require('fs');
// const path = require('path');

// Import Cloudinary to delete files later
const cloudinary = require('cloudinary').v2;

// --- IMPORTANT NOTE ON FILE PATHS ---
// When using multer-storage-cloudinary, req.files will contain the uploaded
// file's details, and the URL to the file on Cloudinary will be in `req.files.fieldName[0].path`.
// The public ID for deletion is often part of this URL or can be specified.
// For files stored in a folder like 'vara-music', the public ID will be 'vara-music/filename_without_extension'.
// We will store the full URL in the database. When deleting, we'll extract the public ID from the URL.

// Upload a new song (previously named createSong in our example, now matching your uploadSong)
exports.uploadSong = async (req, res) => {
    // Note: 'title' is text, 'genres', 'subGenres', 'isExclusive', 'collectionType' are also text fields
    const { title, genres, subGenres, isExclusive, collectionType } = req.body;

    // Cloudinary automatically handles saving to temp directories and provides the Cloudinary URL
    // via req.files. Your multer setup in songRoutes.js uses 'audioFile' and 'imageFile' names.
    const audioFile = req.files && req.files.audioFile && req.files.audioFile.length > 0 ? req.files.audioFile[0] : null;
    const imageFile = req.files && req.files.imageFile && req.files.imageFile.length > 0 ? req.files.imageFile[0] : null;

    if (!audioFile || !imageFile) {
        // If files are missing, consider deleting any partial uploads from Cloudinary if needed,
        // though multer-storage-cloudinary typically handles this if the upload itself fails.
        return res.status(400).json({ success: false, error: 'Both image and audio files are required.' });
    }

    try {
        // Validate Genre and SubGenre IDs (this logic remains the same as it interacts with MongoDB)
        const genrePromises = Array.isArray(genres) ? genres.map(id => Genre.findById(id)) : [];
        const subGenrePromises = Array.isArray(subGenres) ? subGenres.map(id => SubGenre.findById(id)) : [];

        const existingGenres = await Promise.all(genrePromises);
        const existingSubGenres = await Promise.all(subGenrePromises);

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            // If genre/subgenre IDs are invalid, we should ideally also delete the just-uploaded files from Cloudinary
            // This is a more advanced cleanup. For now, we'll proceed with the error.
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid.' });
        }

        const song = new Song({
            title,
            // Store Cloudinary URLs directly in the model
            imageUrl: imageFile.path, // Use .path which is the Cloudinary URL
            audioUrl: audioFile.path, // Use .path which is the Cloudinary URL
            genres,
            subGenres,
            isExclusive: isExclusive === 'true', // Ensure boolean conversion
            collectionType
        });

        await song.save();
        res.status(201).json(song);
    } catch (error) {
        console.error("Error uploading song:", error);
        // If there's an error after files are uploaded to Cloudinary but before saving to DB,
        // you might want to delete them from Cloudinary here. This would require public_ids.
        // For simplicity, we'll just return the error.
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all songs
exports.getAllSongs = async (req, res) => {
    try {
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

        // Function to extract public ID from Cloudinary URL
        const getPublicIdFromCloudinaryUrl = (url) => {
            if (!url) return null;
            // Example URL: https://res.cloudinary.com/dp4vm8pou/image/upload/v123456789/vara-music/my_image.jpg
            // Public ID: vara-music/my_image
            const parts = url.split('/');
            const folderIndex = parts.indexOf('upload') + 1; // Find 'upload' segment, then get next part
            if (folderIndex > 0 && parts[folderIndex]) {
                const publicIdWithExtension = parts.slice(folderIndex).join('/').split('.')[0];
                return publicIdWithExtension;
            }
            return null;
        };

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
        const { title, genres, subGenres, isExclusive, collectionType } = req.body;

        const existingSong = await Song.findById(id);
        if (!existingSong) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        let newImageUrl = existingSong.imageUrl;
        let newAudioUrl = existingSong.audioUrl;

        // Function to extract public ID from Cloudinary URL (defined again for clarity, or could be a helper)
        const getPublicIdFromCloudinaryUrl = (url) => {
            if (!url) return null;
            const parts = url.split('/');
            const uploadIndex = parts.indexOf('upload');
            if (uploadIndex > -1 && parts[uploadIndex + 1]) { // Check if 'upload' and a segment after it exist
                const publicIdWithVersion = parts.slice(uploadIndex + 1).join('/');
                // Remove version number (e.g., 'v123456789/') and extension
                const finalId = publicIdWithVersion.split('/').slice(1).join('/').split('.')[0];
                return finalId;
            }
            return null;
        };


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
            // If genre/subgenre IDs are invalid for update, consider deleting any newly uploaded files
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid for update.' });
        }

        const updatedSong = await Song.findByIdAndUpdate(
            id,
            {
                title,
                imageUrl: newImageUrl, // Update to new Cloudinary URL
                audioUrl: newAudioUrl, // Update to new Cloudinary URL
                genres: genres,
                subGenres: subGenres,
                isExclusive: isExclusive === 'true',
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
