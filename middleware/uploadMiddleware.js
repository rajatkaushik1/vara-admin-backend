const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureUploadDirs = () => {
    const dirs = [
        path.join(__dirname, '../uploads/images'),
        path.join(__dirname, '../uploads/music')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};
ensureUploadDirs(); // Call it immediately to ensure dirs exist on server start

// Configure storage based on fieldname
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'image') {
            cb(null, path.join(__dirname, '../uploads/images'));
        } else if (file.fieldname === 'audio') {
            cb(null, path.join(__dirname, '../uploads/music'));
        } else {
            cb(new Error('Invalid fieldname for file upload'), false);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext); // e.g., 'image-...' or 'audio-...'
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, JPG, or WEBP images are allowed!'), false);
    }
};

// File filter for audio
const audioFilter = (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/aac', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only MP3, WAV, AAC, or OGG audio files are allowed!'), false);
    }
};

// Combined file filter for Multer
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'image') {
        imageFilter(req, file, cb);
    } else if (file.fieldname === 'audio') {
        audioFilter(req, file, cb);
    } else {
        // For non-file fields or unexpected file fields, we can handle or reject
        cb(null, true); // Allow other fields to pass through (like text fields)
    }
};

// Create Multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit for any file (can be adjusted per field if needed)
    }
});

// Export the Multer instance directly
module.exports = upload;