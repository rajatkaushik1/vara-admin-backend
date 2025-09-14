const mongoose = require('mongoose');

const ContentVersionSchema = new mongoose.Schema(
  {
    // A single global doc. Unique key ensures we don't accidentally create multiple records.
    key: { type: String, default: 'global', unique: true, index: true },

    // Global version timestamp (ms since epoch). Bumped on ANY content write.
    v: { type: Number, default: 0 },

    // Per-collection version timestamps (ms).
    songs: { type: Number, default: 0 },
    genres: { type: Number, default: 0 },
    subgenres: { type: Number, default: 0 },
    instruments: { type: Number, default: 0 },

    // NEW: moods version timestamp (ms)
    moods: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContentVersion', ContentVersionSchema);
