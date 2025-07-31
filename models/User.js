const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
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
  // OAuth users will have username: null, admin users will have actual usernames
  username: {
    type: String,
    required: false,
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

// FIXED: Proper indexes that handle OAuth users with null usernames
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Remove unique constraint on username to allow multiple null values for OAuth users
userSchema.index({ username: 1 }, { sparse: true });

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
