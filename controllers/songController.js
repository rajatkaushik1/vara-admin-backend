// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const Genre =require('../models/Genre');
const SubGenre = require('../models/SubGenre');
const { validationResult } = require('express-validator');
// --- FIX: Corrected path to go up two directories to the project root ---
const cloudinary = require('../../cloudinary');

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
        // --- NEW FIELDS ---
        hasVocals,
        bpm,
        key
    } = req.body;

    if (!req.files || !req.files.image || !req.files.audio) {
        return res.status(400).json({ msg: 'Image and audio files are required' });
    }

    try {
        // Upload files to Cloudinary
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
            // --- NEW FIELDS ---
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
        // --- NEW FIELDS ---
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
            // --- NEW FIELDS ---
            hasVocals: hasVocals ? (String(hasVocals).toLowerCase() === 'true') : false,
            bpm,
            key
        };

        // If a new image file is uploaded, update it
        if (req.files && req.files.image) {
            const imageResult = await cloudinary.uploader.upload(req.files.image[0].path, { resource_type: "image", folder: "vara/images" });
            updateData.imageUrl = imageResult.secure_url;
        }

        // If a new audio file is uploaded, update it
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

        // Optional: Delete from Cloudinary as well
        // const publicIdImage = song.imageUrl.split('/').pop().split('.')[0];
        // const publicIdAudio = song.audioUrl.split('/').pop().split('.')[0];
        // await cloudinary.uploader.destroy(`vara/images/${publicIdImage}`);
        // await cloudinary.uploader.destroy(`vara/audio/${publicIdAudio}`, { resource_type: 'video' });

        await song.deleteOne(); // Use deleteOne() instead of remove()

        res.json({ msg: 'Song removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
