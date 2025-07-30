// routes/favoritesRoutes.js
const express = require('express');
const router = express.Router();
const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favoritesController');

// Middleware to check if user is authenticated (you might need to adjust this)
const authenticateUser = (req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    next();
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
};

// Routes
router.get('/', authenticateUser, getFavorites);
router.post('/', authenticateUser, addFavorite);
router.delete('/', authenticateUser, removeFavorite);

module.exports = router;
