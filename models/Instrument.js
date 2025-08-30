const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Instrument name is required'],
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
instrumentSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Instrument', instrumentSchema);
