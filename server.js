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

// --- START PORT BINDING FIX FOR RENDER ---
// Define the PORT to listen on. Render provides it via process.env.PORT.
// For local development, it will fall back to 5000.
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log("✅ Connected to MongoDB");
    // Ensure the server explicitly listens on the PORT determined above.
    // Added an error handler (.on('error')) for better troubleshooting.
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    }).on('error', (err) => {
        // Log any errors if the server fails to bind to the port
        console.error("❌ Server failed to start:", err);
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
});
// --- END PORT BINDING FIX FOR RENDER ---