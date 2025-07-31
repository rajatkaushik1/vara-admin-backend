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

// --- IMPROVED CORS CONFIGURATION ---
const allowedOrigins = [
    'http://localhost:5173',  // Your local frontend development
    'http://localhost:3000',  // Alternative local port
    'https://vara-admin-backend.onrender.com',
    'https://vara-admin-frontend.onrender.com',
    'https://vara-user-frontend.onrender.com'  // Added user frontend
];

// More permissive CORS configuration for development
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // For development: Allow localhost on any port
        if (origin && origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        
        // Log rejected origins for debugging
        console.log(`❌ CORS rejected origin: ${origin}`);
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// --- END CORS CONFIGURATION ---

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add request logging for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
    next();
});

// Routes
app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes); 
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);

// --- Enhanced Root Route for Health Check ---
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Vara Admin Backend is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cors_origins: allowedOrigins
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        services: {
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            cors: 'enabled'
        },
        timestamp: new Date().toISOString()
    });
});

// --- IMPROVED MongoDB CONNECTION AND SERVER START ---
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => {
    console.log("✅ Connected to MongoDB");
    console.log("✅ Database:", mongoose.connection.db.databaseName);

    const renderPort = process.env.PORT || 5000;
    const renderHost = '0.0.0.0';

    const server = app.listen(renderPort, renderHost, () => {
        console.log(`🚀 Server running on http://${renderHost}:${renderPort}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔐 CORS enabled for origins:`, allowedOrigins);
    });

    // Handle server errors
    server.on('error', (err) => {
        console.error("❌ Server failed to start due to port binding:", err);
        if (err.code === 'EADDRINUSE') {
            console.error("The port is already in use by another process.");
        } else if (err.code === 'EACCES') {
            console.error("Permission denied to bind to port.");
        }
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('👋 SIGTERM received, shutting down gracefully');
        server.close(() => {
            mongoose.connection.close();
            process.exit(0);
        });
    });

})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});

// --- Enhanced Global Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately in development
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Export app for testing
module.exports = app;
