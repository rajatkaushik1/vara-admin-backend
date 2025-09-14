const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Routes
const genreRoutes = require("./routes/genreRoutes");
const subGenreRoutes = require("./routes/subGenreRoutes");
const instrumentRoutes = require("./routes/instrumentRoutes");
const songRoutes = require("./routes/songRoutes");
const authRoutes = require("./routes/authRoutes");
const favoritesRoutes = require('./routes/favoritesRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { read: readContentVersion } = require('./utils/contentVersion');
const moodRoutes = require("./routes/moodRoutes");

// Load environment variables
dotenv.config();

const app = express();

/**
 * Hardened CORS: reflect only allowed origins and always answer preflight with 204.
 */
const allowedOrigins = new Set([
  'https://vara-admin-frontend.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Always set Vary for caches
  res.setHeader('Vary', 'Origin');

  // Reflect origin only if in allowlist
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Allowed methods/headers (covers admin frontend fetches with Authorization)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  // Optional exposure
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length');

  // Short-circuit preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lightweight response-time logger (no header dumps)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // Use originalUrl so query strings are visible in logs (good for cache-busting tests)
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(1)} ms`);
  });
  next();
});

// --- ROUTES ---
app.use("/api/genres", genreRoutes);
app.use("/api/subgenres", subGenreRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/moods", moodRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// --- CONTENT VERSION ENDPOINT ---
app.get('/api/content/version', async (req, res) => {
  try {
    const ver = await readContentVersion();
    // Let the browser keep disk cache but always revalidate (cheap 304s)
    res.set('Cache-Control', 'no-cache, must-revalidate');
    return res.status(200).json(ver);
  } catch (err) {
    console.error('content/version error', err);
    return res.status(500).json({ error: 'Failed to read content version' });
  }
});

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

const port = process.env.PORT || 8080;
const host = '0.0.0.0';

  const server = app.listen(port, host, () => {
    console.log(`🚀 Server successfully started on http://${host}:${port}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Unified CORS enabled`);
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

  if (err.message && err.message.includes('authentication failed')) {
    console.error("🔑 This is an authentication error. Please check:");
    console.error("   1. MongoDB username and password are correct");
    console.error("   2. MONGODB_URI environment variable is properly set in Render");
    console.error("   3. MongoDB Atlas allows connections from 0.0.0.0/0 (Render IPs)");
  }

  process.exit(1);
});

// --- ERROR HANDLING ---
process.on('unhandledRejection', (reason) => {
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
