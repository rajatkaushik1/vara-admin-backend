const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  // CHANGED: From imagePath to imageUrl to store Cloudinary URL
  imageUrl: {
    type: String,
    required: true
  },
  // CHANGED: From audioPath to audioUrl to store Cloudinary URL
  audioUrl: {
    type: String,
    required: true
  },
  // Keep genres as an array of ObjectIds
  genres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true
  }],
  // Keep subGenres as an array of ObjectIds
  subGenres: [{
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
    enum: ['free', 'paid'] // Ensure this enum matches values used in controller ('free', 'paid')
  },
  // If your songs also have an 'artist' field, you might want to add it here:
  // artist: {
  //   type: String,
  //   required: true, // or false, depending on your requirements
  //   trim: true
  // },
}, { timestamps: true });

module.exports = mongoose.model('Song', songSchema);
