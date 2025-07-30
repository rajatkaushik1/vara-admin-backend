// server.js
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
// Define allowed origins for CORS.
// This is crucial for your frontend (React app) to communicate with this backend.
  const allowedOrigins = [
            'http://localhost:5173', // Your local React frontend development server
            'https://vara-admin-backend.onrender.com', // Your LIVE Render backend URL
            'https://vara-admin-frontend.onrender.com' // ADDED: Your LIVE Render frontend URL
        ];
        app.use(cors({
            origin: function (origin, callback) {
                // Allow requests with no origin (like mobile apps, curl requests, or same-origin requests)
                if (!origin) return callback(null, true);
                if (allowedOrigins.indexOf(origin) === -1) {
                    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                    return callback(new Error(msg), false);
                }
                return callback(null, true);
            },
            credentials: true // Allows sending HTTP cookies with the request (if needed later for auth)
        }));
// --- END CORS CONFIGURATION ---


// Middleware
app.use(express.json());
// The following line is removed because with Cloudinary,
// the backend will no longer serve local static files from an 'uploads' directory.
// Files will be served directly from Cloudinary URLs.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Routes
const genreRoutes = require("./routes/genreRoutes");
const subGenreRoutes = require("./routes/subGenreRoutes");
const songRoutes = require("./routes/songRoutes");
const authRoutes = require("./routes/authRoutes");
// ADDED: Import auth routes

app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes); 
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);// ADDED: Use auth routes


// --- Simple Root Route for Health Check ---
// Render (and other services) sometimes do a quick check on the root path ('/')
// to see if the server responds.
app.get('/', (req, res) => {
    res.status(200).send('Vara Backend is running!');
});
// --- End Simple Root Route ---

// --- START PORT BINDING FIX FOR RENDER (Attempt 5 - Explicit Host & Exit) ---
// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, {
    // These options are deprecated in newer Mongoose/MongoDB drivers and can be removed.
    // They cause warnings but should not prevent startup. Removing for cleaner logs.
    // useNewUrlParser: true, // Removed as deprecated
    // useUnifiedTopology: true, // Removed as deprecated
})
.then(() => {
    console.log("✅ Connected to MongoDB");

    // Render expects your app to listen on the PORT it provides in the environment.
    const renderPort = process.env.PORT;
    const renderHost = '0.0.0.0'; // Explicitly bind to all available network interfaces

    if (!renderPort) {
        console.error("❌ PORT environment variable is not set. This is critical for Render deployment.");
        // If PORT is not set by Render, the app cannot start. Exit to show explicit failure.
        process.exit(1);
    }

    // Explicitly listen on the provided PORT and HOST.
    app.listen(renderPort, renderHost, () => { // Added renderHost here
        console.log(`🚀 Server running on http://${renderHost}:${renderPort}`);
    }).on('error', (err) => {
        console.error("❌ Server failed to start due to port binding:", err);
        if (err.code === 'EADDRINUSE') {
            console.error("The port is already in use by another process. This should not happen on Render.");
        } else if (err.code === 'EACCES') {
            console.error("Permission denied to bind to port.");
        }
        // If listen fails, the process is likely dead. Exit to signal failure to Render.
        process.exit(1);
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    // If MongoDB connection fails, the server cannot function. Exit to signal failure to Render.
    process.exit(1);
});
// --- End Global Error Handling ---

// --- Global Error Handling for Node.js Process ---
// Catch unhandled promise rejections (async errors)
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Exit process to ensure Render detects a failure, rather than timing out
    process.exit(1);
});

// Catch uncaught exceptions (sync errors)
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Exit process to ensure Render detects a failure, rather than timing out
    process.exit(1);
});
// --- End Global Error Handling ---
