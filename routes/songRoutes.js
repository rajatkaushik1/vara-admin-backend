// routes/songRoutes.js
const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
// Import the controller functions
const { getAllSongs, createSong, updateSong, deleteSong, trackInteraction, getTrendingSongs } = require('../controllers/songController');
const upload = require('../middleware/uploadMiddleware');

// Create a new song (POST with file uploads)
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), createSong);

// Update a song (PUT - JSON only, no file uploads for now)
router.put('/:id', updateSong);

// Delete a song (DELETE)
router.delete('/:id', deleteSong);

// --- NEW: TRACKING ENDPOINTS ---
// Track user interactions (play, download, favorite, seek)
router.post('/track/:songId', trackInteraction);

// Get trending songs
router.get('/trending', getTrendingSongs);

// NEW: Get songs by multiple IDs for taste recommendations
router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ message: 'Song IDs are required' });
    }
    
    const songIds = ids.split(',').filter(id => id.trim());
    
    if (songIds.length === 0) {
      return res.json([]);
    }
    
    const songs = await Song.find({ '_id': { $in: songIds } })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ 'analytics.totalPlays': -1 }); // Sort by popularity
    
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by IDs:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// Get songs by genre IDs for taste recommendations
router.get('/by-genres', async (req, res) => {
  try {
    const { genreIds, subGenreIds, limit = 15 } = req.query;
    
    console.log('🔍 Taste recommendation request:', {
      genreIds,
      subGenreIds,
      limit
    });
    
    const query = {};
    
    if (genreIds) {
      const genreIdArray = genreIds.split(',').filter(id => id.trim());
      // Filter out test IDs that aren't valid MongoDB ObjectIds
      const validGenreIds = genreIdArray.filter(id => {
        return id.match(/^[0-9a-fA-F]{24}$/) && !id.startsWith('genre');
      });
      
      if (validGenreIds.length > 0) {
        query.genres = { $in: validGenreIds };
        console.log('📊 Valid genre IDs:', validGenreIds);
      }
    }
    
    if (subGenreIds) {
      const subGenreIdArray = subGenreIds.split(',').filter(id => id.trim());
      // Filter out test IDs that aren't valid MongoDB ObjectIds
      const validSubGenreIds = subGenreIdArray.filter(id => {
        return id.match(/^[0-9a-fA-F]{24}$/) && !id.startsWith('sub');
      });
      
      if (validSubGenreIds.length > 0) {
        query.subGenres = { $in: validSubGenreIds };
        console.log('📊 Valid subgenre IDs:', validSubGenreIds);
      }
    }
    
    // If no valid genres or subgenres found, return popular songs instead
    if (Object.keys(query).length === 0) {
      console.log('⚠️ No valid genre/subgenre IDs found, returning popular songs');
      const popularSongs = await Song.find()
        .populate('genres', 'name')
        .populate('subGenres', 'name')
        .sort({ 'analytics.totalPlays': -1 })
        .limit(parseInt(limit));
      
      return res.json(popularSongs);
    }
    
    console.log('🔍 MongoDB query:', query);
    
    const songs = await Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ 'analytics.totalPlays': -1 })
      .limit(parseInt(limit));
    
    console.log(`✅ Found ${songs.length} songs for taste recommendations`);
    res.json(songs);
    
  } catch (error) {
    console.error('❌ Error fetching songs by genres:', error);
    res.status(500).json({ 
      message: 'Server error while fetching songs by genres',
      error: error.message 
    });
  }
});

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
