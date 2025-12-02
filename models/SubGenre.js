    // C:\Users\Dell\Desktop\vara-admin\models\SubGenre.js
    const mongoose = require('mongoose');

    const subGenreSchema = new mongoose.Schema({
      name: {
        type: String,
        required: true,
        unique: true, // Ensure sub-genre names are unique
        trim: true
      },
      genre: { // Parent genre reference
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Genre',
        required: true
      },
      imageUrl: { // ADDED: Field for sub-genre image URL
        type: String,
        required: false // Not strictly required for existing sub-genres, but good for new ones
      },
      description: { // ADDED: Field for sub-genre description
        type: String,
        required: false,
        trim: true,
        maxlength: 500 // Optional: Add a max length for descriptions
      }
    }, {
      timestamps: true
    });

    module.exports = mongoose.model('SubGenre', subGenreSchema);
    