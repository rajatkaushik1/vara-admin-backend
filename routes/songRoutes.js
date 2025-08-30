// routes/songRoutes.js
const express = require('express');
const router = express.Router();

const Song = require('../models/Song');
const {
  getAllSongs,
  createSong,
  updateSong,
  deleteSong,
  trackInteraction,
  getTrendingSongs,
  getNewSongs
} = require('../controllers/songController');
const upload = require('../middleware/uploadMiddleware');

// Create a new song (POST with file uploads)
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]),
  createSong
);

// Update a song (PUT - JSON only, no file uploads for now)
router.put('/:id', updateSong);

// Delete a song (DELETE)
router.delete('/:id', deleteSong);

// --- TRACKING ENDPOINT ---
router.post('/track/:songId', trackInteraction);

// Trending and New uploads
router.get('/trending', getTrendingSongs);
router.get('/new', getNewSongs);

// Get songs by multiple IDs (used for taste recommendations)
router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ message: 'Song IDs are required' });

    const songIds = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (songIds.length === 0) return res.json([]);

    const songs = await Song.find({ _id: { $in: songIds } })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .sort({ 'analytics.totalPlays': -1 });

    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by IDs:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// Get songs by genres/subgenres (taste resolver)
router.get('/by-genres', async (req, res) => {
  try {
    const { genreIds, subGenreIds, limit = 15 } = req.query;

    const query = {};
    if (genreIds) {
      const arr = genreIds.split(',').map(s => s.trim()).filter(Boolean);
      const valid = arr.filter(id => /^[0-9a-fA-F]{24}$/.test(id) && !id.startsWith('genre'));
      if (valid.length) query.genres = { $in: valid };
    }
    if (subGenreIds) {
      const arr = subGenreIds.split(',').map(s => s.trim()).filter(Boolean);
      const valid = arr.filter(id => /^[0-9a-fA-F]{24}$/.test(id) && !id.startsWith('sub'));
      if (valid.length) query.subGenres = { $in: valid };
    }

    if (!Object.keys(query).length) {
      const popular = await Song.find()
        .populate('genres', 'name')
        .populate('subGenres', 'name')
        .populate('instruments', 'name')
        .sort({ 'analytics.totalPlays': -1 })
        .limit(parseInt(limit, 10));
      return res.json(popular);
    }

    const songs = await Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .sort({ 'analytics.totalPlays': -1 })
      .limit(parseInt(limit, 10));

    res.json(songs);
  } catch (error) {
    console.error('❌ Error fetching songs by genres:', error);
    res.status(500).json({
      message: 'Server error while fetching songs by genres',
      error: error.message
    });
  }
});

// NEW: Get songs that include a specific instrument
router.get('/instrument/:instrumentId', async (req, res) => {
  try {
    const { instrumentId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(instrumentId)) {
      return res.status(400).json({ message: 'Invalid instrumentId' });
    }
    const songs = await Song.find({ instruments: instrumentId })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by instrument:', error);
    res.status(500).json({ message: 'Server error while fetching songs by instrument' });
  }
});

// NEW: Get songs by multiple instruments (resolver for carousels/recs)
router.get('/by-instruments', async (req, res) => {
  try {
    const { instrumentIds, limit = 15 } = req.query;
    const ids = (instrumentIds || '')
      .split(',')
      .map(s => s.trim())
      .filter(id => /^[0-9a-fA-F]{24}$/.test(id));

    let query = {};
    if (ids.length) {
      query.instruments = { $in: ids };
    }

    // Fallback to popular songs if no valid IDs
    const baseQuery = Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .sort({ 'analytics.totalPlays': -1 })
      .limit(parseInt(limit, 10));

    const songs = await baseQuery;
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by instruments:', error);
    res.status(500).json({ message: 'Server error while fetching songs by instruments' });
  }
});

// Get all songs
router.get('/', async (req, res) => {
  try {
    const songs = await Song.find()
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// Get one song by ID
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name');
    if (!song) return res.status(404).json({ message: 'Song not found' });
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
      .populate('instruments', 'name')
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
      .populate('instruments', 'name')
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
      .populate('instruments', 'name')
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
      .populate('instruments', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching paid songs:', error);
    res.status(500).json({ message: 'Server error while fetching paid songs' });
  }
});

module.exports = router;
