// C:\Users\Dell\Desktop\vara-admin\routes\authRoutes.js
const express = require('express');
const router = express.Router();

const { registerUser, loginUser, getMe, devPromote } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware'); // NEW: strict auth

// @route   POST /api/auth/register
// @desc    Register a new user (for initial admin setup)
// @access  Public (will be restricted after initial admin creation)
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', loginUser);

// @route   GET /api/auth/me
// @desc    Return current authenticated admin/sub-admin
// @access  Private (JWT)
router.get('/me', verifyToken, getMe);

// @route   POST /api/auth/dev/promote
// @desc    Dev-only: promote current user to admin (requires DEV_ADMIN_TOKEN)
// @access  Private + Dev token
router.post('/dev/promote', verifyToken, devPromote);

module.exports = router;

// Don’t change any other function or route beyond what is shown here.
