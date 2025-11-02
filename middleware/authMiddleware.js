const jwt = require('jsonwebtoken');
const User = require('../models/User');

function extractToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && typeof auth === 'string') {
    const parts = auth.split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
  }
  if (req.headers && typeof req.headers['x-access-token'] === 'string') {
    return req.headers['x-access-token'].trim();
  }
  return null;
}

async function verifyToken(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await User.findById(decoded.id).select('_id username email role');
    if (!user) {
      return res.status(401).json({ message: 'User not found for this token' });
    }

    req.user = user;
    next();
  } catch (err) {
    const msg = (err && err.name === 'TokenExpiredError') ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message: msg });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return next();

    const user = await User.findById(decoded.id).select('_id username email role');
    if (user) {
      req.user = user;
    }
    return next();
  } catch {
    return next();
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    return next();
  };
}

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
};
