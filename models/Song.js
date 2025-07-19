// models/Song.js
const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    audioUrl: {
        type: String,
        required: true
    },
    // NEW FIELD: Added duration here
    duration: {
        type: Number, // Store duration in seconds
        default: 0,   // Default to 0 if not provided, will be updated on upload
    },
    genres: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Genre',
        required: true
    }],
    subGenres: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubGenre',
        required: true
    }],
    collectionType: {
        type: String,
        required: true,
        enum: ['free', 'paid']
    },
}, { timestamps: true });

module.exports = mongoose.model('Song', songSchema);
