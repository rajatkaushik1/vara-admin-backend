// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;

/**
 * Helper to parse genre/sub-genre IDs from FormData.
 * FormData sends arrays as JSON strings, so we need to parse them.
 * @param {string | string[]} value The value from req.body
 * @returns {string[]} An array of IDs.
 */
const parseJsonArray = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        // If it's not a valid JSON string, it might be a single value.
        // This part is a fallback, but FormData should send a stringified array.
        return [value];
    }
};

/**
 * Helper to extract a file's public_id from its Cloudinary URL.
 * This is needed for deleting the file from Cloudinary.
 * @param {string} url The full Cloudinary URL.
 * @returns {string | null} The public_id or null if not found.
 */
const getPublicIdFromUrl = (url) => {
    try {
        // Example URL: http://res.cloudinary.com/cloud_name/resource_type/upload/v12345/folder/public_id.format
        const parts = url.split('/');
        const publicIdWithFormat = parts[parts.length - 1];
        const public_id = publicIdWithFormat.split('.')[0];
        // The folder structure is part of the public_id that Cloudinary needs.
        const folder = parts[parts.length - 2];
        return `${folder}/${public_id}`;
    } catch (e) {
        console.error("Could not extract public_id from URL:", url);
        return null;
    }
};


// Get all songs
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.find()
            .populate('genres', 'name')
            .populate('subGenres', 'name')
            .sort({ createdAt: -1 });
        res.json(songs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Create a new song
// This function now correctly assumes the `uploadMiddleware` has already run.
exports.createSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // The `uploadMiddleware` populates `req.files` if files are uploaded.
    if (!req.files || !req.files.image || !req.files.audio) {
        return res.status(400).json({ message: 'Image and audio files are required' });
    }

    const { title, duration, genres, subGenres, collectionType, hasVocals, bpm, key } = req.body;

    try {
        // The middleware has already uploaded the files to Cloudinary.
        // The URL is available in the `path` property provided by `multer-storage-cloudinary`.
        const imageUrl = req.files.image[0].path;
        const audioUrl = req.files.audio[0].path;

        const newSong = new Song({
            title,
            duration,
            genres: parseJsonArray(genres),
            subGenres: parseJsonArray(subGenres),
            collectionType,
            imageUrl,
            audioUrl,
            hasVocals: String(hasVocals).toLowerCase() === 'true',
            bpm,
            key
        });

        const song = await newSong.save();
        res.status(201).json(song);

    } catch (err) {
        console.error('Error in createSong:', err);
        res.status(500).send('Server Error');
    }
};

// Update an existing song
// **FIX**: This now handles a JSON payload, not FormData, matching the frontend.
exports.updateSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Destructure fields from the JSON body.
    const { title, genres, subGenres, collectionType, hasVocals, bpm, key } = req.body;

    const updateData = {
        title,
        genres,
        subGenres,
        collectionType,
        hasVocals,
        bpm,
        key
    };

    // Remove any fields that are undefined so they don't overwrite existing data.
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);


    try {
        const song = await Song.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('genres', 'name').populate('subGenres', 'name');

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        res.json(song);

    } catch (err) {
        console.error('Error in updateSong:', err);
        res.status(500).send('Server Error');
    }
};

// Delete a song
// **IMPROVEMENT**: Now also deletes the associated files from Cloudinary.
exports.deleteSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Delete files from Cloudinary
        if (song.imageUrl) {
            const publicId = getPublicIdFromUrl(song.imageUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
        }
        if (song.audioUrl) {
            const publicId = getPublicIdFromUrl(song.audioUrl);
            if (publicId) {
                // Remember, audio files are 'video' resource type in our middleware
                await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
            }
        }

        // Delete the song from the database
        await song.deleteOne();

        res.json({ message: 'Song and associated files removed' });

    } catch (err) {
        console.error('Error in deleteSong:', err);
        res.status(500).send('Server Error');
    }
};
