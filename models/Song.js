// models/Song.js
const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  genres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true
  }],
  subGenres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubGenre',
    required: true
  }],
  // REMOVED: isExclusive field as per new requirements
  // isExclusive: {
  //   type: Boolean,
  //   default: false
  // },
  collectionType: {
    type: String,
    required: true,
    // CHANGED: Enum values to only 'free' and 'paid'
    enum: ['free', 'paid']
  },
  // You can add an 'artist' field here if it's missing and used in your controller
  // artist: {
  //   type: String,
  //   required: true, // or false, depending on your requirements
  //   trim: true
  // },
}, { timestamps: true });

module.exports = mongoose.model('Song', songSchema);