// controllers/favoritesController.js
const User = require('../models/User');

// Get user's favorites
const getFavorites = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.id).populate('favorites');
    res.json(user.favorites || []);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add song to favorites
const addFavorite = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { songId } = req.body;
    
    const user = await User.findById(req.user.id);
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
};

// Remove song from favorites
const removeFavorite = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { songId } = req.body;
    
    const user = await User.findById(req.user.id);
    if (user.favorites) {
      user.favorites = user.favorites.filter(id => id.toString() !== songId);
      await user.save();
    }
    
    res.json({ message: 'Song removed from favorites', favorites: user.favorites });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite
};
