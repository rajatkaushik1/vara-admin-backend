const mongoose = require('mongoose');

const subGenreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  genre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true
  }
}, { timestamps: true });

// Ensure unique combination of name and genre
subGenreSchema.index({ name: 1, genre: 1 }, { unique: true });

module.exports = mongoose.model('SubGenre', subGenreSchema);