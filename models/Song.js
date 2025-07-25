// vara-admin-backend/models/Song.js

const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    artist: {
        type: String,
        required: true,
        trim: true
    },
    duration: {
        type: Number, // Duration in seconds
        required: true
    },
    genres: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Genre',
        required: true
    }],
    subGenres: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubGenre'
    }],
    moods: [{
        type: String,
        trim: true
    }],
    collectionType: {
        type: String,
        enum: ['free', 'premium', 'paid'],
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    audioUrl: {
        type: String,
        required: true
    },
    // --- NEW FIELDS START ---
    hasVocals: {
        type: Boolean,
        default: false
    },
    bpm: {
        type: Number,
        required: [true, 'BPM is a required field.']
    },
    key: {
        type: String,
        required: [true, 'Music key is a required field.'],
        trim: true
    },
    // --- NEW FIELDS END ---
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Song', songSchema);
