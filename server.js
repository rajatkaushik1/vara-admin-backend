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

// --- START PORT BINDING FIX FOR RENDER (Attempt 3) ---
// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log("✅ Connected to MongoDB");
    
    // Render expects your app to listen on the PORT it provides in the environment.
    // We will directly use process.env.PORT. For local testing, you would typically run
    // with a tool like 'nodemon' or ensure PORT is set in your local .env.
    const renderPort = process.env.PORT; // Get the port provided by Render

    // It's good practice to log if PORT isn't found, though Render should always provide it.
    if (!renderPort) {
        console.error("❌ PORT environment variable is not set. This is required for Render deployment.");
        // If running locally without a .env PORT, you might default here, e.g., renderPort = 5000;
        // But for Render, this indicates a configuration issue if it's not set.
    }

    // Explicitly listen on the port provided by Render.
    // Added an error handler (.on('error')) for better troubleshooting if binding fails.
    app.listen(renderPort, () => {
        console.log(`🚀 Server running on port ${renderPort}`);
    }).on('error', (err) => {
        console.error("❌ Server failed to start due to port binding:", err);
        if (err.code === 'EADDRINUSE') {
            console.error("The port is already in use by another process. This should not happen on Render.");
        } else if (err.code === 'EACCES') {
            console.error("Permission denied to bind to port. Try a higher port number if running locally, or check Render configuration.");
        }
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
});
// --- END PORT BINDING FIX FOR RENDER ---