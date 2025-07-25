// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre');
const { validationResult } = require('express-validator');

// --- FINAL FIX: Correct path is one directory up ---
const cloudinary = require('../cloudinary');

// Get all songs with populated genres and subgenres
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.find()
            .populate('genres', 'name')
            .populate('subGenres', 'name');
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

    const {
        title,
        artist,
        duration,
        genres,
        subGenres,
        moods,
        collectionType,
        hasVocals,
        bpm,
        key
    } = req.body;

    if (!req.files || !req.files.image || !req.files.audio) {
        return res.status(400).json({ msg: 'Image and audio files are required' });
    }

    try {
        const imageResult = await cloudinary.uploader.upload(req.files.image[0].path, { resource_type: "image", folder: "vara/images" });
        const audioResult = await cloudinary.uploader.upload(req.files.audio[0].path, { resource_type: "video", folder: "vara/audio" });

        const newSong = new Song({
            title,
            artist,
            duration,
            genres: JSON.parse(genres),
            subGenres: subGenres ? JSON.parse(subGenres) : [],
            moods: moods ? JSON.parse(moods) : [],
            collectionType,
            imageUrl: imageResult.secure_url,
            audioUrl: audioResult.secure_url,
            hasVocals: hasVocals ? (String(hasVocals).toLowerCase() === 'true') : false,
            bpm,
            key
        });

        const song = await newSong.save();
        res.json(song);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Update an existing song
exports.updateSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        title,
        artist,
        duration,
        genres,
        subGenres,
        moods,
        collectionType,
        hasVocals,
        bpm,
        key
    } = req.body;

    try {
        let song = await Song.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ msg: 'Song not found' });
        }

        const updateData = {
            title,
            artist,
            duration,
            genres: JSON.parse(genres),
            subGenres: subGenres ? JSON.parse(subGenres) : [],
            moods: moods ? JSON.parse(moods) : [],
            collectionType,
            hasVocals: hasVocals ? (String(hasVocals).toLowerCase() === 'true') : false,
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
            { new: true }
        ).populate('genres', 'name').populate('subGenres', 'name');

        res.json(song);

    } catch (err) {
        console.error(err.message);
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
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
