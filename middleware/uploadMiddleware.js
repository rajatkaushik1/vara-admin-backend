// vara-admin-backend/middleware/uploadMiddleware.js
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');

// Configure S3 client for Cloudflare R2 (reused for audio and images)
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Multer-S3 storage for Cloudflare R2 (AUDIO) — unchanged behavior
const r2Storage = multerS3({
  s3: s3Client,
  bucket: process.env.R2_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const baseName = (file.originalname || 'audio').split('.').slice(0, -1).join('.') || 'audio';
    const rawExt = file.originalname && file.originalname.includes('.') ? '.' + file.originalname.split('.').pop() : '.mp3';
    const ext = rawExt.toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `audio/${baseName}-${uniqueSuffix}${ext}`);
  },
});

// NEW: Multer-S3 storage for Cloudflare R2 (IMAGES)
function buildImageKey(file) {
  const map = {
    image: 'images/songs',
    genreImage: 'images/genres',
    subGenreImage: 'images/subgenres',
    instrumentImage: 'images/instruments',
    moodImage: 'images/moods',
  };
  const folder = map[file.fieldname] || 'images/misc';

  const orig = file.originalname || 'image.jpg';
  const ext = (path.extname(orig) || '.jpg').toLowerCase();
  const base = path.basename(orig, ext)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
  const uid = crypto.randomBytes(6).toString('hex');
  const stamp = Date.now();

  return `${folder}/${base || 'image'}-${stamp}-${uid}${ext}`;
}

const r2ImageStorage = multerS3({
  s3: s3Client,
  bucket: process.env.R2_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  cacheControl: 'public, max-age=31536000, immutable',
  metadata: (req, file, cb) => cb(null, { originalName: file.originalname }),
  key: (req, file, cb) => cb(null, buildImageKey(file)),
});

// Create a single multer instance for song uploads: image -> R2 images, audio -> R2 audio
const songUploadStorage = {
  _handleFile: function (req, file, cb) {
    if (file.fieldname === 'image') {
      r2ImageStorage._handleFile(req, file, cb);
    } else if (file.fieldname === 'audio') {
      r2Storage._handleFile(req, file, cb);
    } else {
      cb(new Error('Unexpected field'));
    }
  },
  _removeFile: function (req, file, cb) {
    if (file.fieldname === 'image') {
      r2ImageStorage._removeFile(req, file, cb);
    } else if (file.fieldname === 'audio') {
      r2Storage._removeFile(req, file, cb);
    } else {
      cb(new Error('Unexpected field'));
    }
  }
};

// Exported upload middlewares
// Keep the same export name (uploadImageToCloudinary) for backward compatibility, but it now writes to R2.
const uploadImageToCloudinary = multer({
  storage: r2ImageStorage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10 MB for images
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Song uploader: handle both image and audio in one form
const uploadSongFiles = multer({
  storage: songUploadStorage,
  limits: { fileSize: 1024 * 1024 * 50 }, // 50 MB (audio cap)
});

module.exports = { uploadImageToCloudinary, uploadSongFiles };
