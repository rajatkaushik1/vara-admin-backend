const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const genreRoutes = require("./routes/genreRoutes");
const subGenreRoutes = require("./routes/subGenreRoutes");
const songRoutes = require("./routes/songRoutes");
const authRoutes = require("./routes/authRoutes");
const favoritesRoutes = require('./routes/favoritesRoutes');
const userRoutes = require('./routes/userRoutes');

dotenv.config();

const app = express();

// --- START CORS CONFIGURATION ---
const allowedOrigins = [
    'http://localhost:5173',
    'https://vara-admin-backend.onrender.com',
    'https://vara-admin-frontend.onrender.com'
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
// --- END CORS CONFIGURATION ---

// Middleware
app.use(express.json());

// Routes - REMOVE THE DUPLICATE DECLARATIONS HERE
app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes); 
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);

// --- Simple Root Route for Health Check ---
app.get('/', (req, res) => {
    res.status(200).send('Vara Backend is running!');
});

// --- START PORT BINDING FIX FOR RENDER ---
mongoose.connect(process.env.MONGODB_URI, {})
.then(() => {
    console.log("✅ Connected to MongoDB");

    const renderPort = process.env.PORT;
    const renderHost = '0.0.0.0';

    if (!renderPort) {
        console.error("❌ PORT environment variable is not set. This is critical for Render deployment.");
        process.exit(1);
    }

    app.listen(renderPort, renderHost, () => {
        console.log(`🚀 Server running on http://${renderHost}:${renderPort}`);
    }).on('error', (err) => {
        console.error("❌ Server failed to start due to port binding:", err);
        if (err.code === 'EADDRINUSE') {
            console.error("The port is already in use by another process. This should not happen on Render.");
        } else if (err.code === 'EACCES') {
            console.error("Permission denied to bind to port.");
        }
        process.exit(1);
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});

// --- Global Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});
