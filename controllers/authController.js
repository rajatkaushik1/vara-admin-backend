// C:\Users\Dell\Desktop\vara-admin\controllers\authController.js
    const User = require('../models/User'); // Import the User model
    const jwt = require('jsonwebtoken');   // Import jsonwebtoken for JWT creation

    // Helper function to generate a JWT token
    const generateToken = (id) => {
        // Use a strong, secret key from environment variables
        return jwt.sign({ id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES || '12h', // Token expires in 12 hours (adjust as needed)
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
            // Normalize the identifier (what the user typed into the "Username" field)
            const identifier = (username || '').trim();

            // Basic guard: if either identifier or password is missing, return generic 401
            if (!identifier || !password) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            // Try to find by username first
            let user = await User.findOne({ username: identifier });

            // If not found by username, allow login by email as a fallback
            if (!user) {
                user = await User.findOne({ email: identifier });
            }

            // Check if user exists and password matches
            if (user && (await user.matchPassword(password))) {
                return res.json({
                    _id: user._id,
                    username: user.username,
                    role: user.role,
                    token: generateToken(user._id), // Generate and send JWT
                });
            }

            // Generic 401 for any mismatch, without revealing whether user exists
            return res.status(401).json({ message: 'Invalid username or password' });
        } catch (error) {
            console.error("Error logging in user:", error);
            res.status(500).json({ message: 'Server error during login', error: error.message });
        }
    };

    // @desc    Get current authenticated admin/sub-admin profile
    // @route   GET /api/auth/me
    // @access  Private (requires verifyToken)
    exports.getMe = async (req, res) => {
        try {
            if (!req.user || !req.user._id) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            const user = await User.findById(req.user._id).select('_id username email role name');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            return res.json({
                _id: user._id,
                username: user.username || null,
                email: user.email || null,
                role: user.role || 'user',
                name: user.name || null,
            });
        } catch (error) {
            console.error('Error in getMe:', error);
            return res.status(500).json({ message: 'Server error retrieving profile' });
        }
    };

    // @desc    Dev-only: promote the current authenticated user to admin
    // @route   POST /api/auth/dev/promote
    // @access  Private + Dev token (verifyToken + x-dev-admin-token)
    //          This helps if your current account is not 'admin' yet.
    exports.devPromote = async (req, res) => {
        try {
            const devHeader = req.headers['x-dev-admin-token'] || req.query.token;
            const expected = process.env.DEV_ADMIN_TOKEN;

            if (!expected || devHeader !== expected) {
                return res.status(403).json({ message: 'Forbidden: invalid or missing dev token' });
            }

            if (!req.user || !req.user._id) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            user.role = 'admin';
            await user.save();

            return res.json({
                ok: true,
                message: 'User promoted to admin',
                user: {
                    _id: user._id,
                    username: user.username || null,
                    email: user.email || null,
                    role: user.role,
                },
            });
        } catch (error) {
            console.error('Error in devPromote:', error);
            return res.status(500).json({ message: 'Server error promoting user' });
        }
    };

