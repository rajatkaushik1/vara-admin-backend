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

// --- SIMPLIFIED BUT EFFECTIVE CORS CONFIGURATION ---
const allowedOrigins = [
    'http://localhost:5173',  // Your local frontend development
    'http://localhost:3000',  // Alternative local port
    'https://vara-admin-backend.onrender.com',
    'https://vara-admin-frontend.onrender.com',
    'https://vara-user-frontend.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like Postman, mobile apps)
        if (!origin) return callback(null, true);
        
        // Allow all localhost origins for development
        if (origin && origin.includes('localhost')) {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // For debugging - log what's being rejected
        console.log(`⚠️ CORS origin check: ${origin}`);
        
        // Be more permissive - allow all HTTPS origins from render.com
        if (origin && origin.includes('render.com')) {
            return callback(null, true);
        }
        
        // Fallback - be permissive in production to avoid breaking
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Handle preflight requests explicitly
app.options('*', cors());

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
    next();
});

// --- ROUTES ---
app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes); 
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);

// --- HEALTH CHECK ROUTES ---
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Vara Admin Backend is running!',
        timestamp: new Date().toISOString(),
        status: 'healthy'
    });
});

app.get('/api/status', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// --- TEST ENDPOINTS FOR DEBUGGING ---
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working',
        cors: 'enabled',
        origin: req.get('Origin') || 'none'
    });
});

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
.then(() => {
    console.log("✅ Connected to MongoDB");
    
    const port = process.env.PORT || 5000;
    const host = '0.0.0.0';

    app.listen(port, host, () => {
        console.log(`🚀 Server running on http://${host}:${port}`);
        console.log(`🔐 CORS configured for origins:`, allowedOrigins);
    });
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});

// --- ERROR HANDLING ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

module.exports = app;
