    // C:\Users\Dell\Desktop\vara-admin\routes\authRoutes.js
    const express = require('express');
    const router = express.Router();
    const { registerUser, loginUser } = require('../controllers/authController'); // Import auth controller functions

    // @route   POST /api/auth/register
    // @desc    Register a new user (for initial admin setup)
    // @access  Public (will be restricted after initial admin creation)
    router.post('/register', registerUser);

    // @route   POST /api/auth/login
    // @desc    Authenticate user and get token
    // @access  Public
    router.post('/login', loginUser);

    module.exports = router;
    