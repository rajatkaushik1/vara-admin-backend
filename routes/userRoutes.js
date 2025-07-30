// routes/userRoutes.js (vara-backend)
const express = require('express');
const router = express.Router();
const RegularUser = require('../models/RegularUser');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Get user's favorites
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const user = await RegularUser.findById(req.session.user.id)
      .populate('favorites', 'title artist imageUrl audioUrl collectionType duration');
    
    res.json(user.favorites || []);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add song to favorites
router.post('/favorites', requireAuth, async (req, res) => {
  try {
    const { songId } = req.body;
    const user = await RegularUser.findById(req.session.user.id);
    
    await user.addToFavorites(songId);
    
    res.json({ message: 'Song added to favorites' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove song from favorites
router.delete('/favorites/:songId', requireAuth, async (req, res) => {
  try {
    const { songId } = req.params;
    const user = await RegularUser.findById(req.session.user.id);
    
    await user.removeFromFavorites(songId);
    
    res.json({ message: 'Song removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track download
router.post('/track-download', requireAuth, async (req, res) => {
  try {
    const { songId, songTitle } = req.body;
    const user = await RegularUser.findById(req.session.user.id);
    
    await user.trackDownload(songId, songTitle);
    
    res.json({ message: 'Download tracked' });
  } catch (error) {
    console.error('Error tracking download:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
