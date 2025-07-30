// models/RegularUser.js (for regular users - vara-backend)
const mongoose = require('mongoose');

const regularUserSchema = new mongoose.Schema({
  // Google OAuth fields
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  picture: {
    type: String, // Google profile picture URL
    default: null
  },
  
  // Premium subscription
  is_premium: {
    type: Boolean,
    default: false
  },
  premium_expires_at: {
    type: Date,
    default: null
  },
  
  // User preferences and data
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  
  // YouTube channel info
  youtube_channel_link: {
    type: String,
    trim: true,
    default: null
  },
  youtube_channel_name: {
    type: String,
    trim: true,
    default: null
  },
  
  // Usage tracking
  downloadHistory: [{
    songId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Song' 
    },
    downloadedAt: { 
      type: Date, 
      default: Date.now 
    },
    songTitle: String
  }],
  
  // Activity tracking
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for better query performance
regularUserSchema.index({ email: 1 });
regularUserSchema.index({ googleId: 1 });

// Method to check if user has premium access
regularUserSchema.methods.hasPremiumAccess = function() {
  if (!this.is_premium) return false;
  if (!this.premium_expires_at) return true; // Lifetime premium
  return new Date() < this.premium_expires_at;
};

// Method to add song to favorites
regularUserSchema.methods.addToFavorites = function(songId) {
  if (!this.favorites.includes(songId)) {
    this.favorites.push(songId);
  }
  return this.save();
};

// Method to remove song from favorites
regularUserSchema.methods.removeFromFavorites = function(songId) {
  this.favorites = this.favorites.filter(id => !id.equals(songId));
  return this.save();
};

// Method to track download
regularUserSchema.methods.trackDownload = function(songId, songTitle) {
  this.downloadHistory.push({
    songId,
    songTitle,
    downloadedAt: new Date()
  });
  
  // Keep only last 100 downloads to prevent excessive data
  if (this.downloadHistory.length > 100) {
    this.downloadHistory = this.downloadHistory.slice(-100);
  }
  
  return this.save();
};

const RegularUser = mongoose.model('RegularUser', regularUserSchema);

module.exports = RegularUser;
