// vara-admin-backend/middleware/uploadMiddleware.js

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder;
    // **FIX**: Changed fieldnames to match the frontend FormData
    if (file.fieldname === 'image' || file.fieldname === 'audio') {
      folder = 'vara-music-songs';
    } else if (file.fieldname === 'genreImage') {
      folder = 'vara-music-genres';
    } else if (file.fieldname === 'subGenreImage') {
      folder = 'vara-music-subgenres';
    } else if (file.fieldname === 'instrumentImage') {
      folder = 'vara-music-instruments';
    } else {
      folder = 'vara-music-misc';
    }

    let resource_type = 'image'; // Default to image
    // **FIX**: Changed fieldname to 'audio'
    if (file.fieldname === 'audio') {
      // For audio files, Cloudinary recommends 'video' or 'raw'. 'video' often has better processing.
      resource_type = 'video';
    }

    return {
      folder: folder,
      // Let Cloudinary automatically determine the format for best results
      // format: file.originalname.split('.').pop(),
      public_id: `${file.fieldname}-${Date.now()}`, // Unique public ID
      resource_type: resource_type
    };
  },
});

// Initialize Multer with the Cloudinary storage
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 50 // 50 MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // **FIX**: Changed fieldnames to match the frontend
    if (file.fieldname === 'image' || file.fieldname === 'genreImage' || file.fieldname === 'subGenreImage' || file.fieldname === 'instrumentImage') {
      if (!file.mimetype.startsWith('image')) {
        return cb(new Error('Only image files are allowed!'), false);
      }
    } else if (file.fieldname === 'audio') {
      if (!file.mimetype.startsWith('audio')) {
        return cb(new Error('Only audio files are allowed!'), false);
      }
    }
    cb(null, true);
  }
});

// Export the configured upload middleware
module.exports = upload;
