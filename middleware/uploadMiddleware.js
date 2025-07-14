    // C:\Users\Dell\Desktop\vara-admin\middleware\uploadMiddleware.js
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
        // Determine folder based on file fieldname
        if (file.fieldname === 'imageFile' || file.fieldname === 'audioFile') {
          folder = 'vara-music-songs'; // Folder for song images/audio
        } else if (file.fieldname === 'genreImage') {
          folder = 'vara-music-genres'; // Folder for genre images
        } else if (file.fieldname === 'subGenreImage') {
          folder = 'vara-music-subgenres'; // Folder for sub-genre images
        } else {
          folder = 'vara-music-misc'; // Fallback for other files
        }

        let resource_type = 'image'; // Default to image
        if (file.fieldname === 'audioFile') {
          resource_type = 'raw'; // For audio files, use 'raw' resource type
        }

        return {
          folder: folder,
          format: file.originalname.split('.').pop(), // Use original file extension
          public_id: `${file.fieldname}-${Date.now()}`, // Unique public ID
          resource_type: resource_type // Set resource type
        };
      },
    });

    // Initialize Multer with the Cloudinary storage
    // Use .fields() to accept multiple files under different field names
    const upload = multer({
      storage: storage,
      limits: {
        fileSize: 1024 * 1024 * 50 // 50 MB file size limit (adjust as needed)
      },
      fileFilter: (req, file, cb) => {
        // Basic file type validation
        if (file.fieldname === 'imageFile' || file.fieldname === 'genreImage' || file.fieldname === 'subGenreImage') {
          if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'), false);
          }
        } else if (file.fieldname === 'audioFile') {
          if (!file.originalname.match(/\.(mp3|wav|aac|ogg)$/i)) {
            return cb(new Error('Only audio files (mp3, wav, aac, ogg) are allowed!'), false);
          }
        }
        cb(null, true);
      }
    });

    // Export the configured upload middleware
    // We'll use this in routes like: upload.fields([{ name: 'genreImage', maxCount: 1 }])
    module.exports = upload;
    