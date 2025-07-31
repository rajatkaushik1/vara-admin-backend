const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    required: false
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String
  },
  is_premium: {
    type: Boolean,
    default: false
  },
  subscription_type: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  downloads: [{
    songId: {
      type: String,
      required: true
    },
    songTitle: {
      type: String,
      required: true
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Optional admin fields (if needed for admin users)
  username: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: false
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'user'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Ensure no duplicate indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

// Keep your existing password methods for admin users
const bcrypt = require('bcryptjs');

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
