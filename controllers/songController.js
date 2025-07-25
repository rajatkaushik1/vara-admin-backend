// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to ensure a value is an array
const ensureArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
        } catch (e) {
            return [value];
        }
    }
    return [];
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
exports.createSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // --- FIX: Removed 'artist' from this line ---
    const { title, duration, genres, subGenres, collectionType, hasVocals, bpm, key } = req.body;

    if (!req.files || !req.files.image || !req.files.audio) {
        return res.status(400).json({ msg: 'Image and audio files are required' });
    }

    try {
        const imageResult = await cloudinary.uploader.upload(req.files.image[0].path, { resource_type: "image", folder: "vara/images" });
        const audioResult = await cloudinary.uploader.upload(req.files.audio[0].path, { resource_type: "video", folder: "vara/audio" });

        const newSong = new Song({
            title,
            // artist field is omitted, will use schema default
            duration,
            genres: ensureArray(genres),
            subGenres: ensureArray(subGenres),
            collectionType,
            imageUrl: imageResult.secure_url,
            audioUrl: audioResult.secure_url,
            hasVocals: String(hasVocals).toLowerCase() === 'true',
            bpm,
            key
        });

        const song = await newSong.save();
        res.json(song);

    } catch (err) {
        console.error('Error in createSong:', err);
        res.status(500).send('Server Error');
    }
};

// Update an existing song
exports.updateSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // --- FIX: Removed 'artist' from this line ---
    const { title, duration, genres, subGenres, collectionType, hasVocals, bpm, key } = req.body;

    try {
        let song = await Song.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ msg: 'Song not found' });
        }

        const updateData = {
            title,
            // artist field is omitted, will not be changed
            duration,
            genres: ensureArray(genres),
            subGenres: ensureArray(subGenres),
            collectionType,
            hasVocals: String(hasVocals).toLowerCase() === 'true',
            bpm,
            key
        };

        if (req.files && req.files.image) {
            const imageResult = await cloudinary.uploader.upload(req.files.image[0].path, { resource_type: "image", folder: "vara/images" });
            updateData.imageUrl = imageResult.secure_url;
        }

        if (req.files && req.files.audio) {
            const audioResult = await cloudinary.uploader.upload(req.files.audio[0].path, { resource_type: "video", folder: "vara/audio" });
            updateData.audioUrl = audioResult.secure_url;
        }

        song = await Song.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.json(song);

    } catch (err) {
        console.error('Error in updateSong:', err);
        res.status(500).send('Server Error');
    }
};

// Delete a song
exports.deleteSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ msg: 'Song not found' });
        }
        await song.deleteOne();
        res.json({ msg: 'Song removed' });
    } catch (err) {
        console.error('Error in deleteSong:', err);
        res.status(500).send('Server Error');
    }
};
