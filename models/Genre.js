    // C:\Users\Dell\Desktop\vara-admin\models\Genre.js
    const mongoose = require('mongoose');

    const genreSchema = new mongoose.Schema({
      name: {
        type: String,
        required: true,
        unique: true, // Ensure genre names are unique
        trim: true
      },
      imageUrl: { // ADDED: Field for genre image URL
        type: String,
        required: false // Not strictly required for existing genres, but good for new ones
      },
      description: { // ADDED: Field for genre description
        type: String,
        required: false,
        trim: true,
        maxlength: 500 // Optional: Add a max length for descriptions
      }
    }, {
      timestamps: true // Adds createdAt and updatedAt timestamps automatically
    });

    module.exports = mongoose.model('Genre', genreSchema);
    