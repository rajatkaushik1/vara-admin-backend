// vara-admin-backend/routes/songRoutes.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const songController = require('../controllers/songController');
// --- FINAL FIX: Using the correct filenames from your repository ---
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// @route   GET api/songs
// @desc    Get all songs
// @access  Public
router.get('/', songController.getAllSongs);

// @route   POST api/songs
// @desc    Create a song
// @access  Private
router.post(
    '/',
    [
        auth,
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('artist', 'Artist is required').not().isEmpty(),
            check('duration', 'Duration is required and must be a number').isNumeric(),
            check('genres', 'Genres are required').not().isEmpty(),
            check('collectionType', 'Collection type is required').isIn(['free', 'premium', 'paid']),
            // --- NEW VALIDATORS ---
            check('bpm', 'BPM is required and must be a number').not().isEmpty().isNumeric(),
            check('key', 'Music key is required').not().isEmpty(),
            check('hasVocals', 'Has Vocals must be a boolean').optional().isBoolean()
        ]
    ],
    songController.createSong
);

// @route   PUT api/songs/:id
// @desc    Update a song
// @access  Private
router.put(
    '/:id',
    [
        auth,
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('artist', 'Artist is required').not().isEmpty(),
            check('duration', 'Duration is required and must be a number').isNumeric(),
            check('genres', 'Genres are required').not().isEmpty(),
            check('collectionType', 'Collection type is required').isIn(['free', 'premium', 'paid']),
            // --- NEW VALIDATORS ---
            check('bpm', 'BPM is required and must be a number').not().isEmpty().isNumeric(),
            check('key', 'Music key is required').not().isEmpty(),
            check('hasVocals', 'Has Vocals must be a boolean').optional().isBoolean()
        ]
    ],
    songController.updateSong
);

// @route   DELETE api/songs/:id
// @desc    Delete a song
// @access  Private
router.delete('/:id', auth, songController.deleteSong);

module.exports = router;
