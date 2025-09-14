// vara-admin-backend/middleware/uploadMiddleware.js

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Configure Cloudinary storage for Multer (IMAGES ONLY)
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder;
    if (file.fieldname === 'image') {
      folder = 'vara-music-songs';
    } else if (file.fieldname === 'genreImage') {
      folder = 'vara-music-genres';
    } else if (file.fieldname === 'subGenreImage') {
      folder = 'vara-music-subgenres';
    } else if (file.fieldname === 'instrumentImage') {
      folder = 'vara-music-instruments';
    } else if (file.fieldname === 'moodImage') {
      folder = 'vara-music-moods';
    } else {
      folder = 'vara-music-misc';
    }
    return {
      folder: folder,
      public_id: `${file.fieldname}-${Date.now()}`,
      resource_type: 'image'
    };
  },
});

// Configure Multer-S3 storage for Cloudflare R2 for AUDIO
const r2Storage = multerS3({
  s3: s3Client,
  bucket: process.env.R2_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = file.originalname.split('.')[0];
    const extension = file.originalname.split('.').pop();
    cb(null, `audio/${fileName}-${uniqueSuffix}.${extension}`);
  },
});

// Create separate multer instances for images (Cloudinary) and audio (R2)
const uploadImageToCloudinary = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10 MB limit for images
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

const uploadAudioToR2 = multer({
  storage: r2Storage,
  limits: { fileSize: 1024 * 1024 * 50 }, // 50 MB limit for audio
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio')) {
      return cb(new Error('Only audio files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Create a custom storage engine that routes files based on fieldname
const songUploadStorage = {
  _handleFile: function (req, file, cb) {
    if (file.fieldname === 'image') {
      cloudinaryStorage._handleFile(req, file, cb);
    } else if (file.fieldname === 'audio') {
      r2Storage._handleFile(req, file, cb);
    } else {
      cb(new Error('Unexpected field'));
    }
  },
  _removeFile: function (req, file, cb) {
    if (file.fieldname === 'image') {
      cloudinaryStorage._removeFile(req, file, cb);
    } else if (file.fieldname === 'audio') {
      r2Storage._removeFile(req, file, cb);
    } else {
      cb(new Error('Unexpected field'));
    }
  }
};

// Create a single multer instance for song uploads using the custom storage
const uploadSongFiles = multer({
  storage: songUploadStorage,
  limits: { fileSize: 1024 * 1024 * 50 }, // Use the larger limit for audio
});

// Export the configured upload middlewares
module.exports = { uploadImageToCloudinary, uploadSongFiles };
