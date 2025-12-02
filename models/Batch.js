const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Batch name is required'],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Unique index (case-sensitive at MongoDB level). We will still perform
// a case-insensitive pre-check in the controller using collation to avoid
// duplicates like "Ads" vs "ADS".
batchSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Batch', batchSchema);
