// routes/songRoutes.js
const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
// Import the controller functions
const { getAllSongs, createSong, updateSong, deleteSong } = require('../controllers/songController');
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

// 🔥 1. Trending This Week - Get most popular songs from last 7 days
router.get('/trending/week', async (req, res) => {
  try {
    // For now, return newest songs as trending (we'll implement real analytics later)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const trendingSongs = await Song.find({
      createdAt: { $gte: sevenDaysAgo }
    })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    
    // If not enough new songs, fill with random popular songs
    if (trendingSongs.length < 10) {
      const additionalSongs = await Song.find({
        _id: { $nin: trendingSongs.map(s => s._id) }
      })
        .populate('genres', 'name')
        .populate('subGenres', 'name')
        .sort({ createdAt: -1 })
        .limit(20 - trendingSongs.length);
      
      trendingSongs.push(...additionalSongs);
    }
    
    res.json(trendingSongs);
  } catch (error) {
    console.error('Error fetching trending songs:', error);
    res.status(500).json({ message: 'Server error while fetching trending songs' });
  }
});

// 🆕 2. New in Platform - Latest uploads (7-10 days)
router.get('/new/platform', async (req, res) => {
  try {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    const newSongs = await Song.find({
      createdAt: { $gte: tenDaysAgo }
    })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(newSongs);
  } catch (error) {
    console.error('Error fetching new songs:', error);
    res.status(500).json({ message: 'Server error while fetching new songs' });
  }
});

// 🎁 3. Weekly Recommendations - Auto-curated mix
router.get('/recommendations/weekly', async (req, res) => {
  try {
    // 40% from trending (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trending = await Song.find({
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 }).limit(8);

    // 30% from new platform (last 10 days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const newSongs = await Song.find({
      createdAt: { $gte: tenDaysAgo },
      _id: { $nin: trending.map(s => s._id) }
    }).sort({ createdAt: -1 }).limit(6);

    // 30% from undiscovered songs (older, random)
    const undiscovered = await Song.aggregate([
      {
        $match: {
          createdAt: { $lt: tenDaysAgo },
          _id: { $nin: [...trending.map(s => s._id), ...newSongs.map(s => s._id)] }
        }
      },
      { $sample: { size: 6 } }
    ]);

    // Populate genres and subgenres for undiscovered songs
    const populatedUndiscovered = await Song.populate(undiscovered, [
      { path: 'genres', select: 'name' },
      { path: 'subGenres', select: 'name' }
    ]);

    // Combine and shuffle
    const recommendations = [
      ...trending,
      ...newSongs,
      ...populatedUndiscovered
    ];

    // Shuffle the array
    for (let i = recommendations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [recommendations[i], recommendations[j]] = [recommendations[j], recommendations[i]];
    }

    // Populate genres and subgenres for trending and new songs
    await Song.populate(recommendations, [
      { path: 'genres', select: 'name' },
      { path: 'subGenres', select: 'name' }
    ]);

    res.json(recommendations.slice(0, 20));
  } catch (error) {
    console.error('Error fetching weekly recommendations:', error);
    res.status(500).json({ message: 'Server error while fetching recommendations' });
  }
});

// 💡 4. Based on Your Taste - Personalized recommendations (requires login)
router.get('/recommendations/personal', async (req, res) => {
  // This endpoint will be called with user ID from frontend
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: 'User ID required for personalized recommendations' });
  }

  try {
    // For now, return random songs (we'll implement real personalization later)
    const personalizedSongs = await Song.aggregate([
      { $sample: { size: 20 } }
    ]);

    // Populate genres and subgenres
    const populatedSongs = await Song.populate(personalizedSongs, [
      { path: 'genres', select: 'name' },
      { path: 'subGenres', select: 'name' }
    ]);

    res.json(populatedSongs);
  } catch (error) {
    console.error('Error fetching personalized recommendations:', error);
    res.status(500).json({ message: 'Server error while fetching personalized recommendations' });
  }
});

// 🔁 5. Listen Again - Get songs by IDs (from user's listen history)
router.post('/listen-again', async (req, res) => {
  try {
    const { songIds } = req.body;
    
    if (!songIds || !Array.isArray(songIds)) {
      return res.status(400).json({ message: 'Song IDs array required' });
    }

    // Convert string IDs to ObjectIds and find songs
    const objectIds = songIds.map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch (e) {
        return null;
      }
    }).filter(id => id !== null);

    const songs = await Song.find({
      _id: { $in: objectIds }
    })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .sort({ createdAt: -1 });

    res.json(songs);
  } catch (error) {
    console.error('Error fetching listen again songs:', error);
    res.status(500).json({ message: 'Server error while fetching listen again songs' });
  }
});

module.exports = router;
