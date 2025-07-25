// vara-admin-backend/models/Song.js

const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    // --- ARTIST FIELD IS NOW OPTIONAL ---
    artist: {
        type: String,
        trim: true,
        default: 'VARA Music' // Provides a default value if none is given
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
    collectionType: {
        type: String,
        enum: ['free', 'paid'], // Removed 'premium' as it's not in your frontend form
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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Song', songSchema);
