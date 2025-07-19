// C:\Users\Dell\Desktop\vara-admin\controllers\songController.js
const Song = require('../models/Song');
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre');
const cloudinary = require('cloudinary').v2;

// Function to extract public ID from Cloudinary URL (helper for delete/update)
const getPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    // Find the 'upload' segment, then get the part after it
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex > -1 && parts.length > uploadIndex + 1) {
        // The public ID starts after 'v<version_number>/'
        const publicIdWithVersion = parts.slice(uploadIndex + 1).join('/');
        // Remove the 'v<version_number>/' prefix and file extension
        const finalId = publicIdWithVersion.split('/').slice(1).join('/').split('.')[0];
        return finalId;
    }
    return null;
};

// NEW HELPER FUNCTION: Safely parses a field that should be an array of IDs
const parseArrayFromBody = (fieldValue) => {
    // If it's already an array, return it directly
    if (Array.isArray(fieldValue)) {
        return fieldValue;
    }
    // If it's a non-empty string, try to parse it
    if (typeof fieldValue === 'string' && fieldValue.trim() !== '') {
        try {
            const parsed = JSON.parse(fieldValue);
            // If successfully parsed and it's an array, return it
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            // If JSON parsing fails, assume it's a comma-separated string
            console.warn(`Failed to parse JSON string for array field, attempting comma-split fallback: ${fieldValue}`, e);
            return fieldValue.split(',').map(item => item.trim()).filter(item => item);
        }
    }
    // Default to an empty array if invalid type, empty string, or parsing failed
    return [];
};


// Upload a new song (MODIFIED TO UPLOAD TO CLOUDINARY FIRST AND CAPTURE DURATION,
// AND ROBUSTLY PARSE GENRES/SUBGENRES)
exports.uploadSong = async (req, res) => {
    const { title, genres, subGenres, collectionType } = req.body;

    const audioFile = req.files && req.files.audioFile && req.files.audioFile.length > 0 ? req.files.audioFile[0] : null;
    const imageFile = req.files && req.files.imageFile && req.files.imageFile.length > 0 ? req.files.imageFile[0] : null;

    if (!audioFile || !imageFile) {
        return res.status(400).json({ success: false, error: 'Both audio and image files are required.' });
    }

    try {
        // Use the new helper function to safely parse genres and subGenres
        const genreIds = parseArrayFromBody(genres);
        const subGenreIds = parseArrayFromBody(subGenres);

        // Validate Genre and SubGenre IDs
        const existingGenres = await Promise.all(genreIds.map(id => Genre.findById(id)));
        const existingSubGenres = await Promise.all(subGenreIds.map(id => SubGenre.findById(id)));

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid.' });
        }

        // Upload files to Cloudinary FIRST
        const audioUploadResult = await cloudinary.uploader.upload(audioFile.path, {
            folder: 'vara-music',
            resource_type: 'video', // Use 'video' to get duration for audio files
        });

        const imageUploadResult = await cloudinary.uploader.upload(imageFile.path, {
            folder: 'vara-music',
        });

        // Extract duration from Cloudinary audio upload result
        const duration = audioUploadResult.duration || 0; // duration is in seconds

        const song = new Song({
            title,
            imageUrl: imageUploadResult.secure_url, // Use Cloudinary URL
            audioUrl: audioUploadResult.secure_url, // Use Cloudinary URL
            duration: duration, // NEW: Save the extracted duration
            genres: genreIds, // Use parsed IDs
            subGenres: subGenreIds, // Use parsed IDs
            collectionType
        });

        await song.save();
        res.status(201).json(song);
    } catch (error) {
        console.error("Error uploading song:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all songs (NO CHANGE NEEDED HERE, as Mongoose will return the new 'duration' field by default)
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

// Delete a song by ID (including associated files from Cloudinary) - NO CHANGE NEEDED
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

        // Delete audio from Cloudinary (resource_type: 'video' for audio/video)
        if (songToDelete.audioUrl) {
            const publicId = getPublicIdFromCloudinaryUrl(songToDelete.audioUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }, (error, result) => {
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

// Update a song by ID (handles file re-uploads to Cloudinary and duration update)
exports.updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, genres, subGenres, collectionType } = req.body;

        const existingSong = await Song.findById(id);
        if (!existingSong) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        let newImageUrl = existingSong.imageUrl;
        let newAudioUrl = existingSong.audioUrl;
        let newDuration = existingSong.duration; // Initialize with existing duration

        // Use the new helper function to safely parse genres and subGenres
        const genreIds = parseArrayFromBody(genres);
        const subGenreIds = parseArrayFromBody(subGenres);

        // Validate Genre and SubGenre IDs for update
        const existingGenres = await Promise.all(genreIds.map(id => Genre.findById(id)));
        const existingSubGenres = await Promise.all(subGenreIds.map(id => SubGenre.findById(id)));

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid for update.' });
        }

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
            const imageUploadResult = await cloudinary.uploader.upload(req.files.imageFile[0].path, {
                folder: 'vara-music',
            });
            newImageUrl = imageUploadResult.secure_url;
        }

        // Handle new audio upload
        if (req.files && req.files.audioFile && req.files.audioFile.length > 0) {
            // Delete old audio from Cloudinary if it exists
            if (existingSong.audioUrl) {
                const oldPublicId = getPublicIdFromCloudinaryUrl(existingSong.audioUrl);
                if (oldPublicId) {
                    await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'video' }, (error, result) => {
                        if (error) console.error("Failed to delete old audio from Cloudinary:", error);
                        else console.log("Cloudinary old audio deletion result:", result);
                    });
                }
            }
            const audioUploadResult = await cloudinary.uploader.upload(req.files.audioFile[0].path, {
                folder: 'vara-music',
                resource_type: 'video', // Use 'video' to get duration for audio files
            });
            newAudioUrl = audioUploadResult.secure_url;
            newDuration = audioUploadResult.duration || 0; // NEW: Update duration if audio changes
        }

        const updatedSong = await Song.findByIdAndUpdate(
            id,
            {
                title,
                imageUrl: newImageUrl,
                audioUrl: newAudioUrl,
                duration: newDuration, // NEW: Pass the updated duration
                genres: genreIds, // Use parsed IDs
                subGenres: subGenreIds, // Use parsed IDs
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
