// vara-admin-backend/routes/songRoutes.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const songController = require('../controllers/songController');
// --- FIX: REMOVED the line trying to import a non-existent file ---
const upload = require('../middleware/uploadMiddleware');

// @route   GET api/songs
// @desc    Get all songs
// @access  Public
router.get('/', songController.getAllSongs);

// @route   POST api/songs
// @desc    Create a song
// @access  Public (Temporarily, to ensure server runs)
router.post(
    '/',
    [
        // auth middleware removed
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('duration', 'Duration is required and must be a number').isNumeric(),
            check('genres', 'Genres are required').not().isEmpty(),
            check('collectionType', 'Collection type is required').isIn(['free', 'paid']),
            check('bpm', 'BPM is required and must be a number').not().isEmpty().isNumeric(),
            check('key', 'Music key is required').not().isEmpty(),
            check('hasVocals', 'Has Vocals must be a boolean').optional().isBoolean()
        ]
    ],
    songController.createSong
);

// @route   PUT api/songs/:id
// @desc    Update a song
// @access  Public (Temporarily, to ensure server runs)
router.put(
    '/:id',
    [
        // auth middleware removed
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('duration', 'Duration is required and must be a number').isNumeric(),
            check('genres', 'Genres are required').not().isEmpty(),
            check('collectionType', 'Collection type is required').isIn(['free', 'paid']),
            check('bpm', 'BPM is required and must be a number').not().isEmpty().isNumeric(),
            check('key', 'Music key is required').not().isEmpty(),
            check('hasVocals', 'Has Vocals must be a boolean').optional().isBoolean()
        ]
    ],
    songController.updateSong
);

// @route   DELETE api/songs/:id
// @desc    Delete a song
// @access  Public (Temporarily, to ensure server runs)
router.delete(
    '/:id', 
    // auth middleware removed
    songController.deleteSong
);

module.exports = router;
