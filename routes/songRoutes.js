// routes/songRoutes.js
const express = require('express');
const router = express.Router();
const Song = require('../models/Song');

// Get all songs with populated genre and subgenre data
router.get('/', async (req, res) => {
  try {
    const songs = await Song.find()
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('genres', 'name')
      .populate('subGenres', 'name');
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }
    
    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ message: 'Server error while fetching song' });
  }
});

// Get songs by genre
router.get('/genre/:genreId', async (req, res) => {
  try {
    const songs = await Song.find({ genres: req.params.genreId })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by genre:', error);
    res.status(500).json({ message: 'Server error while fetching songs by genre' });
  }
});

// Get songs by subgenre
router.get('/subgenre/:subGenreId', async (req, res) => {
  try {
    const songs = await Song.find({ subGenres: req.params.subGenreId })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by subgenre:', error);
    res.status(500).json({ message: 'Server error while fetching songs by subgenre' });
  }
});

// Get free songs only
router.get('/collection/free', async (req, res) => {
  try {
    const songs = await Song.find({ collectionType: 'free' })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching free songs:', error);
    res.status(500).json({ message: 'Server error while fetching free songs' });
  }
});

// Get paid songs only
router.get('/collection/paid', async (req, res) => {
  try {
    const songs = await Song.find({ collectionType: 'paid' })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching paid songs:', error);
    res.status(500).json({ message: 'Server error while fetching paid songs' });
  }
});

module.exports = router;
