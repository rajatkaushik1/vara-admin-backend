// vara-admin-backend/routes/songRoutes.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const songController = require('../controllers/songController');
const upload = require('../middleware/uploadMiddleware');
// const auth = require('../middleware/authMiddleware'); // Uncomment this when you re-enable authentication

// @route   GET api/songs
// @desc    Get all songs
// @access  Private (should be)
router.get(
    '/',
    // auth, // Add auth middleware here
    songController.getAllSongs
);

// @route   POST api/songs
// @desc    Create a new song with file uploads
// @access  Private (should be)
router.post(
    '/',
    // auth, // Add auth middleware here
    // 1. Multer middleware runs first to handle file uploads
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'audio', maxCount: 1 }
    ]),
    // 2. Validation middleware runs next on the text fields in the FormData
    [
        check('title', 'Title is required').not().isEmpty(),
        check('duration', 'Duration is required').not().isEmpty().isNumeric(),
        check('genres', 'Genres are required').not().isEmpty(),
        check('collectionType', 'Collection type is required').isIn(['free', 'paid']),
        check('bpm', 'BPM is required').not().isEmpty().isNumeric(),
        check('key', 'Music key is required').not().isEmpty(),
        check('hasVocals', 'hasVocals must be a boolean').isBoolean()
    ],
    // 3. Controller runs last
    songController.createSong
);

// @route   PUT api/songs/:id
// @desc    Update a song's metadata (no file changes)
// @access  Private (should be)
router.put(
    '/:id',
    // auth, // Add auth middleware here
    
    // **DEBUGGING STEP**: The validation middleware has been temporarily removed.
    // If the update works without this, it confirms one of the validation rules was causing the 400 error.
    // We can add them back one by one later to find the specific issue.
    //
    // [
    //     check('title', 'Title is required').optional().not().isEmpty(),
    //     check('genres', 'Genres must be an array').optional().isArray(),
    //     check('collectionType', 'Collection type is required').optional().isIn(['free', 'paid']),
    //     check('bpm', 'BPM must be a number').optional().isNumeric(),
    //     check('key', 'Music key is required').optional().not().isEmpty(),
    //     check('hasVocals', 'hasVocals must be a boolean').optional().isBoolean()
    // ],

    songController.updateSong
);

// @route   DELETE api/songs/:id
// @desc    Delete a song
// @access  Private (should be)
router.delete(
    '/:id',
    // auth, // Add auth middleware here
    songController.deleteSong
);

module.exports = router;
