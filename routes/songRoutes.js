// routes/songRoutes.js
const express = require('express');
const router = express.Router();

const Song = require('../models/Song');
const {
  getAllSongs,
  getMySongs,          // NEW
  createSong,
  updateSong,
  deleteSong,
  trackInteraction,
  getTrendingSongs,
  getNewSongs
} = require('../controllers/songController');
const { uploadSongFiles } = require('../middleware/uploadMiddleware');
const cache = require('../middleware/cache');
const cacheControl = require('../middleware/cacheControl');

// NEW: Auth middleware imports
const { verifyToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');

// Create a new song (POST with file uploads)
// CHANGE: verifyToken + requireRole before multer to avoid heavy uploads from unauth users
router.post(
  '/',
  verifyToken,
  requireRole('admin', 'editor'),
  uploadSongFiles.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]),
  createSong
);

// Update a song (PUT - JSON only, no file uploads for now)
// CHANGE: protect with verifyToken + requireRole
router.put('/:id', verifyToken, requireRole('admin', 'editor'), updateSong);

// Delete a song (DELETE)
// CHANGE: protect with verifyToken + requireRole
router.delete('/:id', verifyToken, requireRole('admin', 'editor'), deleteSong);

// --- TRACKING ENDPOINT ---
router.post('/track/:songId', trackInteraction);

// Trending and New uploads (use controller; already populate moods there)
router.get('/trending', cacheControl(60), cache(30), getTrendingSongs);
router.get('/new', cacheControl(60), cache(30), getNewSongs);

// Get songs by multiple IDs (used for taste recommendations)
router.get('/by-ids', cacheControl(60), cache(30), async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ message: 'Song IDs are required' });

    const songIds = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (songIds.length === 0) return res.json([]);

    const songs = await Song.find({ _id: { $in: songIds } })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .sort({ 'analytics.totalPlays': -1 });

    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by IDs:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// Get songs by genres/subgenres (taste resolver)
router.get('/by-genres', cacheControl(60), cache(30), async (req, res) => {
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
        .populate('moods', 'name')
        .sort({ 'analytics.totalPlays': -1 })
        .limit(parseInt(limit, 10));
      return res.json(popular);
    }

    const songs = await Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
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

// Get songs that include a specific instrument
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
      .populate('moods', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by instrument:', error);
    res.status(500).json({ message: 'Server error while fetching songs by instrument' });
  }
});

// Get songs by multiple instruments (resolver for carousels/recs)
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

    const songs = await Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .sort({ 'analytics.totalPlays': -1 })
      .limit(parseInt(limit, 10));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by instruments:', error);
    res.status(500).json({ message: 'Server error while fetching songs by instruments' });
  }
});

// NEW: Get songs that include a specific mood
router.get('/mood/:moodId', async (req, res) => {
  try {
    const { moodId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(moodId)) {
      return res.status(400).json({ message: 'Invalid moodId' });
    }
    const songs = await Song.find({ moods: moodId })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by mood:', error);
    res.status(500).json({ message: 'Server error while fetching songs by mood' });
  }
});

// NEW: Get songs by multiple moods (resolver)
router.get('/by-moods', async (req, res) => {
  try {
    const { moodIds, limit = 15 } = req.query;
    const ids = (moodIds || '')
      .split(',')
      .map(s => s.trim())
      .filter(id => /^[0-9a-fA-F]{24}$/.test(id));

    const query = {};
    if (ids.length) {
      query.moods = { $in: ids };
    }

    const songs = await Song.find(query)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .sort({ 'analytics.totalPlays': -1 })
      .limit(parseInt(limit, 10));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs by moods:', error);
    res.status(500).json({ message: 'Server error while fetching songs by moods' });
  }
});

// Get only my songs (ownership list) - strict auth
router.get('/mine', verifyToken, requireRole('admin', 'editor'), getMySongs);

// Get all songs
// CHANGE: Use optionalAuth so sub-admins receive filtered results; keep caching for public reads.
router.get('/', optionalAuth, cacheControl(60), cache(30), getAllSongs);

// Get one song by ID
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name');
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
      .populate('moods', 'name')
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
      .populate('moods', 'name')
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
      .populate('moods', 'name')
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
      .populate('moods', 'name')
      .sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    console.error('Error fetching paid songs:', error);
    res.status(500).json({ message: 'Server error while fetching paid songs' });
  }
});

module.exports = router;
