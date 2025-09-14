const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Mood name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure fast unique lookups
moodSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Mood', moodSchema);
