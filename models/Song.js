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
    // NEW: Instruments are independent from genres/sub-genres
    instruments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Instrument'
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
    // --- NEW: TRACKING FIELDS FOR ANALYTICS ---
    analytics: {
        totalPlays: {
            type: Number,
            default: 0
        },
        totalDownloads: {
            type: Number,
            default: 0
        },
        totalFavorites: {
            type: Number,
            default: 0
        },
        totalPlaytimeHours: {
            type: Number,
            default: 0 // Total listening time in hours
        },
        lastPlayedAt: {
            type: Date
        },
        trendingScore: {
            type: Number,
            default: 0 // Calculated score for trending
        },
        weeklyPlays: {
            type: Number,
            default: 0 // Plays in the last 7 days
        },
        weeklyDownloads: {
            type: Number,
            default: 0 // Downloads in the last 7 days
        },
        weeklyFavorites: {
            type: Number,
            default: 0 // Favorites in the last 7 days
        },
        lastTrendingUpdate: {
            type: Date,
            default: Date.now
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for trending queries
songSchema.index({ 'analytics.trendingScore': -1 });
songSchema.index({ 'analytics.totalPlays': -1 });
songSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Song', songSchema);
