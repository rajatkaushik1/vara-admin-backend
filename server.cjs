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

// Load environment variables
dotenv.config();

const app = express();

// --- ENVIRONMENT VALIDATION ---
console.log('🔍 Environment Variables Check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('PORT:', process.env.PORT || 'not set');
console.log('MONGODB_URI exists:', process.env.MONGODB_URI ? 'YES' : 'NO');

if (!process.env.MONGODB_URI) {
    console.error('❌ CRITICAL ERROR: MONGODB_URI environment variable is not set!');
    console.error('Please set MONGODB_URI in your Render dashboard environment variables.');
    process.exit(1);
}

// Log first part of MongoDB URI for debugging (without credentials)
const uriStart = process.env.MONGODB_URI.split('@')[0].substring(0, 20);
console.log('MongoDB URI format check:', uriStart + '...');

// --- SIMPLIFIED AND PERMISSIVE CORS CONFIGURATION ---
app.use(cors({
    origin: function (origin, callback) {
        // Always allow requests (for debugging)
        console.log(`🌐 CORS Request from origin: ${origin || 'no-origin'}`);
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Kuma-Revision'],
    optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

// --- ENHANCED CORS CONFIGURATION FOR ADMIN FRONTEND ---
app.use(cors({
    origin: function (origin, callback) {
        // Define allowed origins
        const allowedOrigins = [
            'https://vara-admin-frontend.onrender.com', // ✅ Add admin frontend
            'http://localhost:3000',                     // Local admin frontend
            'http://localhost:5173',                     // Local user frontend
            'http://localhost:5174',                     // Alternative Vite port
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        if (allowedOrigins.includes(origin)) {
            console.log(`✅ CORS allowed for origin: ${origin}`);
            return callback(null, true);
        }
        
        // Log and allow in development (for debugging)
        console.log(`⚠️ CORS request from unlisted origin: ${origin} - allowing for development`);
        return callback(null, true); // Allow all origins in development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Kuma-Revision'],
    optionsSuccessStatus: 200
}));

// ✅ ENHANCED: Handle preflight requests with proper headers
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
    console.log('Headers:', req.headers);
    next();
});

// --- ROUTES ---
app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes); 
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Vara Admin Backend is running!',
        timestamp: new Date().toISOString(),
        mongodb_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// --- MONGODB CONNECTION WITH BETTER ERROR HANDLING ---
console.log('🔄 Attempting MongoDB connection...');

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => {
    console.log("✅ Successfully connected to MongoDB");
    console.log("✅ Database name:", mongoose.connection.db.databaseName);
    
    const port = process.env.PORT || 5000;
    const host = '0.0.0.0';

    const server = app.listen(port, host, () => {
        console.log(`🚀 Server successfully started on http://${host}:${port}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔐 CORS enabled for ALL origins (development mode)`);
    });

    server.on('error', (err) => {
        console.error("❌ Server startup error:", err);
        process.exit(1);
    });

})
.catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    console.error("❌ Error details:", {
        name: err.name,
        message: err.message,
        code: err.code
    });
    
    if (err.message.includes('authentication failed')) {
        console.error("🔑 This is an authentication error. Please check:");
        console.error("   1. MongoDB username and password are correct");
        console.error("   2. MONGODB_URI environment variable is properly set in Render");
        console.error("   3. MongoDB Atlas allows connections from 0.0.0.0/0 (Render IPs)");
    }
    
    process.exit(1);
});

// --- ERROR HANDLING ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        process.exit(0);
    });
});

module.exports = app;
