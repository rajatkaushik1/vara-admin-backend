    // C:\Users\Dell\Desktop\vara-admin\controllers\authController.js
    const User = require('../models/User'); // Import the User model
    const jwt = require('jsonwebtoken');   // Import jsonwebtoken for JWT creation

    // Helper function to generate a JWT token
    const generateToken = (id) => {
        // Use a strong, secret key from environment variables
        return jwt.sign({ id }, process.env.JWT_SECRET, {
            expiresIn: '1h', // Token expires in 1 hour (adjust as needed)
        });
    };

    // @desc    Register a new admin user
    // @route   POST /api/auth/register
    // @access  Public (for initial setup, will be restricted later)
    exports.registerUser = async (req, res) => {
        const { username, password, role } = req.body;

        try {
            // Check if user already exists
            const userExists = await User.findOne({ username });
            if (userExists) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // Create new user
            const user = await User.create({
                username,
                password, // Password will be hashed by the pre-save hook in User model
                role: role || 'admin' // Default to 'admin' if not specified
            });

            if (user) {
                res.status(201).json({
                    _id: user._id,
                    username: user.username,
                    role: user.role,
                    token: generateToken(user._id), // Generate and send JWT
                });
            } else {
                res.status(400).json({ message: 'Invalid user data' });
            }
        } catch (error) {
            console.error("Error registering user:", error);
            res.status(500).json({ message: 'Server error during registration', error: error.message });
        }
    };

    // @desc    Authenticate user & get token
    // @route   POST /api/auth/login
    // @access  Public
    exports.loginUser = async (req, res) => {
        const { username, password } = req.body;

        try {
            // Check if user exists
            const user = await User.findOne({ username });

            // Check if user exists and password matches
            if (user && (await user.matchPassword(password))) {
                res.json({
                    _id: user._id,
                    username: user.username,
                    role: user.role,
                    token: generateToken(user._id), // Generate and send JWT
                });
            } else {
                res.status(401).json({ message: 'Invalid username or password' });
            }
        } catch (error) {
            console.error("Error logging in user:", error);
            res.status(500).json({ message: 'Server error during login', error: error.message });
        }
    };
    