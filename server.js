// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
// const path = require("path"); // No longer strictly needed if not serving local static files

dotenv.config();

const app = express();

// --- START CORS CONFIGURATION ---
// Define allowed origins for CORS.
// This is crucial for your frontend (React app) to communicate with this backend.
const allowedOrigins = [
    'http://localhost:5173', // Your local React frontend development server
    // IMPORTANT: AFTER you deploy your backend to Render.com and get its URL,
    // you MUST add your Render backend URL here.
    // Example: 'https://your-backend-name.onrender.com'
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

app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);

// --- Simple Root Route for Health Check ---
// Render (and other services) sometimes do a quick check on the root path ('/')
// to see if the server responds.
app.get('/', (req, res) => {
    res.status(200).send('Vara Backend is running!');
});
// --- End Simple Root Route ---

// --- START PORT BINDING FIX FOR RENDER (Attempt 4) ---
// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, {
    // These options are deprecated in newer Mongoose/MongoDB drivers and can be removed.
    // They cause warnings but should not prevent startup. Removing for cleaner logs.
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
})
.then(() => {
    console.log("✅ Connected to MongoDB");
    
    const renderPort = process.env.PORT; // Get the port provided by Render

    if (!renderPort) {
        console.error("❌ PORT environment variable is not set. This is required for Render deployment.");
        // If this error happens on Render, it indicates a fundamental Render configuration issue.
        // For local development, if PORT isn't in .env, you'd usually default to 5000.
        // For Render, we expect it to be set.
    }

    app.listen(renderPort, () => {
        console.log(`🚀 Server running on port ${renderPort}`);
    }).on('error', (err) => {
        console.error("❌ Server failed to start due to port binding:", err);
        if (err.code === 'EADDRINUSE') {
            console.error("The port is already in use. This should not happen on Render.");
        } else if (err.code === 'EACCES') {
            console.error("Permission denied to bind to port.");
        }
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    // If MongoDB connection fails, this will be logged, and the server won't start listening.
});
// --- END PORT BINDING FIX FOR RENDER ---

// --- Global Error Handling for Node.js Process ---
// Catch unhandled promise rejections (async errors)
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
    // Consider graceful shutdown if this is a critical unhandled rejection
    // process.exit(1); // Exit with a failure code
});

// Catch uncaught exceptions (sync errors)
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // This is a last-resort error handler.
    // Perform any cleanup, then gracefully shut down the process.
    // process.exit(1); // Exit with a failure code
});
// --- End Global Error Handling ---