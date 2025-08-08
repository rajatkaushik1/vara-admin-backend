// vara-admin-backend/models/SongAnalytics.js

const mongoose = require('mongoose');

// Detailed interaction tracking for analytics
const songAnalyticsSchema = new mongoose.Schema({
    songId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
        required: true
    },
    userId: {
        type: String, // Can be IP address for anonymous users or user ID for logged-in users
        required: true
    },
    userEmail: {
        type: String, // Store user email if available for admin tracking
        default: null
    },
    interactionType: {
        type: String,
        enum: ['play', 'download', 'favorite', 'unfavorite', 'seek'],
        required: true
    },
    // For play interactions
    playData: {
        startTime: {
            type: Number, // Timestamp in seconds where play started
            default: 0
        },
        endTime: {
            type: Number, // Timestamp in seconds where play ended
            default: null
        },
        duration: {
            type: Number, // How long the user actually listened (in seconds)
            default: 0
        },
        completionPercentage: {
            type: Number, // Percentage of song completed (0-100)
            default: 0
        },
        skipPositions: [{
            from: Number, // Position user skipped from
            to: Number,   // Position user skipped to
            timestamp: { type: Date, default: Date.now }
        }]
    },
    // For seek/timestamp interactions (popular positions)
    seekData: {
        fromPosition: {
            type: Number, // Position in seconds where seek started
            required: function() { return this.interactionType === 'seek'; }
        },
        toPosition: {
            type: Number, // Position in seconds where seek ended
            required: function() { return this.interactionType === 'seek'; }
        }
    },
    // Browser/Device info for analytics
    metadata: {
        userAgent: String,
        ipAddress: String,
        country: String,
        device: String,
        browser: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Indexes for efficient queries
songAnalyticsSchema.index({ songId: 1, timestamp: -1 });
songAnalyticsSchema.index({ songId: 1, interactionType: 1, timestamp: -1 });
songAnalyticsSchema.index({ timestamp: -1 });
songAnalyticsSchema.index({ userId: 1, timestamp: -1 });
songAnalyticsSchema.index({ userEmail: 1, timestamp: -1 });
songAnalyticsSchema.index({ userEmail: 1, interactionType: 1, timestamp: -1 });

// Method to get popular timestamps for a song
songAnalyticsSchema.statics.getPopularTimestamps = async function(songId, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                songId: mongoose.Types.ObjectId(songId),
                interactionType: 'seek',
                timestamp: { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: {
                    // Group by 10-second intervals
                    interval: { $floor: { $divide: ['$seekData.toPosition', 10] } }
                },
                count: { $sum: 1 },
                avgPosition: { $avg: '$seekData.toPosition' }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 20 // Top 20 popular positions
        }
    ]);
};

// Method to get song statistics
songAnalyticsSchema.statics.getSongStats = async function(songId, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                songId: mongoose.Types.ObjectId(songId),
                timestamp: { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: '$interactionType',
                count: { $sum: 1 },
                totalDuration: { $sum: '$playData.duration' },
                avgCompletionRate: { $avg: '$playData.completionPercentage' }
            }
        }
    ]);
};

module.exports = mongoose.model('SongAnalytics', songAnalyticsSchema);
