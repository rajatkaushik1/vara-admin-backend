// C:\Users\Dell\Desktop\vara-admin\models\User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Import bcryptjs for password hashing

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // Ensure usernames are unique
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6 // Enforce a minimum password length
  },
  role: { // To distinguish between different types of users (e.g., 'admin', 'editor', 'user')
    type: String,
    enum: ['admin', 'editor', 'user'],
    default: 'admin' // Default to 'admin' for your admin panel
  },
  // ADD: Favorites field to store user's favorite songs
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// --- Mongoose Middleware: Hash password before saving ---
// 'pre' hook runs before a document is saved to the database.
// 'this' refers to the document being saved.
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    // Generate a salt (random string) to add to the password before hashing
    const salt = await bcrypt.genSalt(10); // 10 is the cost factor (higher = more secure, slower)
    // Hash the password with the hashed password
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Proceed with saving the document
  } catch (error) {
    next(error); // Pass any errors to the next middleware/error handler
  }
});

// --- Mongoose Method: Compare password for login ---
// Add a method to the userSchema to compare a given password with the hashed password
userSchema.methods.matchPassword = async function(enteredPassword) {
  // Use bcrypt.compare to compare the entered password with the hashed password in the database
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
