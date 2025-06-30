const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  imagePath: {
    type: String,
    required: true
  },
  audioPath: {
    type: String,
    required: true
  },
 genres: [{ // Changed from 'genre' to 'genres' (plural) and wrapped in array
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true
}],
subGenres: [{ // Changed from 'subGenre' to 'subGenres' (plural) and wrapped in array
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubGenre',
    required: true
}],
  isExclusive: {
    type: Boolean,
    default: false
  },
  collectionType: {
    type: String,
    required: true,
    enum: ['A', 'B']
  }
}, { timestamps: true });

module.exports = mongoose.model('Song', songSchema);