// routes/songRoutes.js
const express = require("express");
const router = express.Router();
const songController = require("../controllers/songController"); // Import the controller
const multer = require("multer"); // Import multer
const { CloudinaryStorage } = require("multer-storage-cloudinary"); // Import CloudinaryStorage
const cloudinary = require("cloudinary").v2; // Import cloudinary

// Configure Cloudinary with credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "vara-music", // Folder in Cloudinary where files will be stored
    resource_type: "auto", // Automatically detect if it's image or raw (for audio)
    // You can add more params like transformation, format, etc.
  },
});

// Initialize multer with Cloudinary storage
const upload = multer({ storage: storage });

// --- Song Routes ---

// Route to create/upload a new song (handles file uploads)
// 'upload.fields' is used to handle multiple files (audio and image)
router.post(
  "/",
  upload.fields([
    { name: "audioFile", maxCount: 1 },
    { name: "imageFile", maxCount: 1 },
  ]),
  songController.uploadSong // <--- CORRECTED: Changed from createSong to uploadSong
);

// Other existing routes
router.get("/", songController.getAllSongs);
// router.get("/:id", songController.getSongById); // REMOVED: Not exported by your current songController
router.put("/:id", songController.updateSong);
router.delete("/:id", songController.deleteSong);

module.exports = router;