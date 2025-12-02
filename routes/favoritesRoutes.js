// routes/favoritesRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Get user's favorites
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id)
      .populate('favorites', 'title artist imageUrl audioUrl collectionType duration');
    
    res.json(user.favorites || []);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add song to favorites
router.post('/', requireAuth, async (req, res) => {
  try {
    const { songId } = req.body;
    const user = await User.findById(req.session.user.id);
    
    if (!user.favorites) {
      user.favorites = [];
    }
    
    if (!user.favorites.includes(songId)) {
      user.favorites.push(songId);
      await user.save();
    }
    
    res.json({ message: 'Song added to favorites', favorites: user.favorites });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove song from favorites
router.delete('/:songId', requireAuth, async (req, res) => {
  try {
    const { songId } = req.params;
    const user = await User.findById(req.session.user.id);
    
    if (user.favorites) {
      user.favorites = user.favorites.filter(id => id.toString() !== songId);
      await user.save();
    }
    
    res.json({ message: 'Song removed from favorites', favorites: user.favorites });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
