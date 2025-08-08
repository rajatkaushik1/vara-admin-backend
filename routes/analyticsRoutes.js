// vara-admin-backend/routes/analyticsRoutes.js

const express = require('express');
const router = express.Router();
const { 
    getAllSongsAnalytics, 
    getSongAnalytics, 
    getPlatformStats, 
    resetWeeklyCounters,
    getListenAgain
} = require('../controllers/analyticsController');

// Get analytics for all songs
router.get('/songs', getAllSongsAnalytics);

// Get detailed analytics for a specific song
router.get('/songs/:songId', getSongAnalytics);

// Get platform-wide statistics
router.get('/platform', getPlatformStats);

// Reset weekly counters (admin only)
router.post('/reset-weekly', resetWeeklyCounters);

// "Listen Again" (login required - identified via userEmail or userId)
router.get('/listen-again', getListenAgain);

module.exports = router;
