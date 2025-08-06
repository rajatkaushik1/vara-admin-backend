// vara-admin-backend/controllers/analyticsController.js

const Song = require('../models/Song');
const SongAnalytics = require('../models/SongAnalytics');

// Get comprehensive analytics for all songs
exports.getAllSongsAnalytics = async (req, res) => {
    try {
        const songs = await Song.find()
            .populate('genres', 'name')
            .populate('subGenres', 'name')
            .sort({ 'analytics.totalPlays': -1 });

        const analyticsData = songs.map(song => ({
            _id: song._id,
            title: song.title,
            artist: song.artist,
            genres: song.genres,
            subGenres: song.subGenres,
            collectionType: song.collectionType,
            createdAt: song.createdAt,
            analytics: {
                totalPlays: song.analytics.totalPlays,
                totalDownloads: song.analytics.totalDownloads,
                totalFavorites: song.analytics.totalFavorites,
                totalPlaytimeHours: song.analytics.totalPlaytimeHours,
                trendingScore: song.analytics.trendingScore,
                weeklyPlays: song.analytics.weeklyPlays,
                weeklyDownloads: song.analytics.weeklyDownloads,
                weeklyFavorites: song.analytics.weeklyFavorites,
                lastPlayedAt: song.analytics.lastPlayedAt
            }
        }));

        res.json(analyticsData);

    } catch (error) {
        console.error('Error fetching all songs analytics:', error);
        res.status(500).json({ message: 'Server error while fetching analytics' });
    }
};

// Get detailed analytics for a specific song
exports.getSongAnalytics = async (req, res) => {
    try {
        const { songId } = req.params;
        const { days = 7 } = req.query;

        const song = await Song.findById(songId)
            .populate('genres', 'name')
            .populate('subGenres', 'name');

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Get popular timestamps
        const popularTimestamps = await SongAnalytics.getPopularTimestamps(songId, days);

        // Get detailed statistics
        const detailedStats = await SongAnalytics.getSongStats(songId, days);

        // Get recent interactions
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentInteractions = await SongAnalytics.find({
            songId,
            timestamp: { $gte: cutoffDate }
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .select('interactionType playData timestamp userId userEmail');

        // Calculate average completion rate
        const playInteractions = recentInteractions.filter(i => i.interactionType === 'play');
        const avgCompletionRate = playInteractions.length > 0 
            ? playInteractions.reduce((sum, play) => sum + (play.playData?.completionPercentage || 0), 0) / playInteractions.length
            : 0;

        res.json({
            song: {
                _id: song._id,
                title: song.title,
                artist: song.artist,
                duration: song.duration,
                genres: song.genres,
                subGenres: song.subGenres,
                analytics: song.analytics
            },
            popularTimestamps,
            detailedStats,
            recentInteractions,
            avgCompletionRate,
            periodDays: days
        });

    } catch (error) {
        console.error('Error fetching song analytics:', error);
        res.status(500).json({ message: 'Server error while fetching song analytics' });
    }
};

// Get platform-wide statistics
exports.getPlatformStats = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Total songs
        const totalSongs = await Song.countDocuments();

        // Total plays, downloads, favorites
        const totalStats = await Song.aggregate([
            {
                $group: {
                    _id: null,
                    totalPlays: { $sum: '$analytics.totalPlays' },
                    totalDownloads: { $sum: '$analytics.totalDownloads' },
                    totalFavorites: { $sum: '$analytics.totalFavorites' },
                    totalPlaytimeHours: { $sum: '$analytics.totalPlaytimeHours' },
                    weeklyPlays: { $sum: '$analytics.weeklyPlays' },
                    weeklyDownloads: { $sum: '$analytics.weeklyDownloads' },
                    weeklyFavorites: { $sum: '$analytics.weeklyFavorites' }
                }
            }
        ]);

        // Most popular songs
        const topSongs = await Song.find()
            .populate('genres', 'name')
            .sort({ 'analytics.totalPlays': -1 })
            .limit(10)
            .select('title artist analytics.totalPlays analytics.totalDownloads analytics.totalFavorites');

        // Recent activity
        const recentActivity = await SongAnalytics.find({
            timestamp: { $gte: cutoffDate }
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('songId', 'title artist')
        .select('songId interactionType timestamp userEmail');

        res.json({
            totalSongs,
            stats: totalStats[0] || {
                totalPlays: 0,
                totalDownloads: 0,
                totalFavorites: 0,
                totalPlaytimeHours: 0,
                weeklyPlays: 0,
                weeklyDownloads: 0,
                weeklyFavorites: 0
            },
            topSongs,
            recentActivity,
            periodDays: days
        });

    } catch (error) {
        console.error('Error fetching platform stats:', error);
        res.status(500).json({ message: 'Server error while fetching platform stats' });
    }
};

// Reset weekly counters (should be called via cron job)
exports.resetWeeklyCounters = async (req, res) => {
    try {
        await Song.updateMany(
            {},
            {
                $set: {
                    'analytics.weeklyPlays': 0,
                    'analytics.weeklyDownloads': 0,
                    'analytics.weeklyFavorites': 0,
                    'analytics.trendingScore': 0,
                    'analytics.lastTrendingUpdate': new Date()
                }
            }
        );

        res.json({ message: 'Weekly counters reset successfully' });

    } catch (error) {
        console.error('Error resetting weekly counters:', error);
        res.status(500).json({ message: 'Server error while resetting counters' });
    }
};
