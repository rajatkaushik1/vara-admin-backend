// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const SongAnalytics = require('../models/SongAnalytics');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Helper to parse genre/sub-genre IDs from FormData.
 * FormData sends arrays as JSON strings, so we need to parse them.
 * @param {string | string[]} value The value from req.body
 * @returns {string[]} An array of IDs.
 */
const parseJsonArray = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        // If it's not a valid JSON string, it might be a single value.
        // This part is a fallback, but FormData should send a stringified array.
        return [value];
    }
};

/**
 * Helper to extract a file's public_id from its Cloudinary URL.
 * This is needed for deleting the file from Cloudinary.
 * @param {string} url The full Cloudinary URL.
 * @returns {string | null} The public_id or null if not found.
 */
const getPublicIdFromUrl = (url) => {
    try {
        // Example URL: http://res.cloudinary.com/cloud_name/resource_type/upload/v12345/folder/public_id.format
        const parts = url.split('/');
        const publicIdWithFormat = parts[parts.length - 1];
        const public_id = publicIdWithFormat.split('.')[0];
        // The folder structure is part of the public_id that Cloudinary needs.
        const folder = parts[parts.length - 2];
        return `${folder}/${public_id}`;
    } catch (e) {
        console.error("Could not extract public_id from URL:", url);
        return null;
    }
};


// Get all songs
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.find()
            .populate('genres', 'name')
            .populate('subGenres', 'name')
            .populate('instruments', 'name')
            .sort({ createdAt: -1 })
            .lean(); // return plain objects (faster, less CPU)
        res.json(songs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Create a new song
// This function now correctly assumes the `uploadMiddleware` has already run.
exports.createSong = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }

  // Validate files existence
  if (!req.files || !req.files.image || !req.files.audio) {
    return res.status(400).json({ ok: false, message: 'Image and audio files are required' });
  }

  const { title, duration, genres, subGenres, instruments, collectionType, hasVocals, bpm, key } = req.body;

  try {
    // Files set by upload middleware:
    // - Cloudinary image: req.files.image[0].path (public)
    // - R2 audio: req.files.audio[0].key + (optional) location; we prefer R2_PUBLIC_BASE_URL for public access
    const imageFile = req.files.image[0];
    const audioFile = req.files.audio[0];

    const imageUrl = imageFile.path;

    // Build a public audioUrl using R2_PUBLIC_BASE_URL if available
    const base = (process.env.R2_PUBLIC_BASE_URL && process.env.R2_PUBLIC_BASE_URL.trim())
      ? process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')
      : '';

    let audioUrl = '';
    if (base && audioFile.key) {
      // Always prefer your public domain
      audioUrl = `${base}/${audioFile.key}`;
    } else if (audioFile.location) {
      // Fallback to S3 location (may be private if bucket is not public)
      audioUrl = audioFile.location;
    } else if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_BUCKET_NAME && audioFile.key) {
      // Last resort: r2.cloudflarestorage.com URL (will only work if bucket allows public GET)
      audioUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${audioFile.key}`;
    }

    if (!audioUrl) {
      return res.status(500).json({ ok: false, message: 'Could not determine audio URL after upload' });
    }

    const newSong = new Song({
      title: title && typeof title === 'string' ? title : '',
      duration: Number(duration) || 0,
      genres: parseJsonArray(genres),
      subGenres: parseJsonArray(subGenres),
      instruments: parseJsonArray(instruments),
      collectionType,
      imageUrl,
      audioUrl,
      // Save the S3 key for reliable deletion later
      audioKey: audioFile.key || undefined,
      hasVocals: String(hasVocals).toLowerCase() === 'true',
      bpm,
      key
    });

    // Save the song
    const saved = await newSong.save();

    // Populate for a nicer response (frontend also refetches)
    const populated = await Song.findById(saved._id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name');

    return res.status(201).json({ ok: true, song: populated || saved });
  } catch (err) {
    console.error('Error in createSong:', err);
    return res.status(500).json({ ok: false, message: 'Server Error while creating song', error: err.message });
  }
};

// Update an existing song
// **FIX**: This now handles a JSON payload, not FormData, matching the frontend.
exports.updateSong = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Destructure fields from the JSON body.
    const { title, genres, subGenres, instruments, collectionType, hasVocals, bpm, key } = req.body;

    const updateData = {
        title,
        genres,
        subGenres,
        instruments,
        collectionType,
        hasVocals,
        bpm,
        key
    };

    // Remove any fields that are undefined so they don't overwrite existing data.
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);


    try {
        const song = await Song.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('genres', 'name').populate('subGenres', 'name').populate('instruments', 'name');

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        res.json(song);

    } catch (err) {
        console.error('Error in updateSong:', err);
        res.status(500).send('Server Error');
    }
};

// Delete a song
// **IMPROVEMENT**: Now also deletes the associated files from Cloudinary.
exports.deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Delete image from Cloudinary (best-effort)
    if (song.imageUrl) {
      const publicId = getPublicIdFromUrl(song.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (imgErr) {
          console.warn('Failed to delete image from Cloudinary:', imgErr?.message || imgErr);
        }
      }
    }

    // Delete audio from Cloudflare R2 (best-effort)
    if (song.audioUrl) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME;

        // If we have an audioKey, use it directly (most reliable)
        let key = song.audioKey;

        // Otherwise derive it from the URL path
        if (!key) {
          const extractKey = (urlStr) => {
            try {
              const u = new URL(urlStr);
              // Remove leading slash
              let path = u.pathname.replace(/^\/+/, ''); // "BUCKET/audio/file.mp3" or "audio/file.mp3"
              // If path begins with "<bucketName>/", strip that prefix
              if (bucketName && path.startsWith(bucketName + '/')) {
                path = path.slice(bucketName.length + 1);
              }
              return path;
            } catch (e) {
              return null;
            }
          };
          key = extractKey(song.audioUrl);
        }

        if (key) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
        } else {
          console.warn('Could not derive R2 object key from audioUrl:', song.audioUrl);
        }
      } catch (r2Error) {
        console.error('Failed to delete audio from R2 (continuing with DB deletion):', r2Error?.message || r2Error);
      }
    }

    // Delete the song from the database
    await song.deleteOne();

    return res.json({ message: 'Song and associated files removed' });
  } catch (err) {
    console.error('Error in deleteSong:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// --- NEW: TRACKING FUNCTIONALITY ---

// Track user interactions (play, download, favorite, seek)
exports.trackInteraction = async (req, res) => {
    try {
        const { songId } = req.params;
        const { 
            interactionType, 
            playData, 
            seekData, 
            userId, 
            userEmail,
            metadata 
        } = req.body;

        // Validate required fields
        if (!interactionType || !userId) {
            return res.status(400).json({ 
                message: 'interactionType and userId are required' 
            });
        }

        // Find the song
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Create detailed analytics record
        const analyticsRecord = new SongAnalytics({
            songId,
            userId,
            userEmail,
            interactionType,
            playData,
            seekData,
            metadata: {
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip || req.connection.remoteAddress,
                ...metadata
            }
        });

        await analyticsRecord.save();

        // Update song analytics based on interaction type
        const updateData = {};
        
        switch (interactionType) {
            case 'play':
                updateData['analytics.totalPlays'] = song.analytics.totalPlays + 1;
                updateData['analytics.weeklyPlays'] = song.analytics.weeklyPlays + 1;
                updateData['analytics.lastPlayedAt'] = new Date();
                
                // Add playtime if provided
                if (playData && playData.duration) {
                    const additionalHours = playData.duration / 3600; // Convert seconds to hours
                    updateData['analytics.totalPlaytimeHours'] = song.analytics.totalPlaytimeHours + additionalHours;
                }
                break;
                
            case 'download':
                updateData['analytics.totalDownloads'] = song.analytics.totalDownloads + 1;
                updateData['analytics.weeklyDownloads'] = song.analytics.weeklyDownloads + 1;
                break;
                
            case 'favorite':
                updateData['analytics.totalFavorites'] = song.analytics.totalFavorites + 1;
                updateData['analytics.weeklyFavorites'] = song.analytics.weeklyFavorites + 1;
                break;
                
            case 'unfavorite':
                updateData['analytics.totalFavorites'] = Math.max(0, song.analytics.totalFavorites - 1);
                updateData['analytics.weeklyFavorites'] = Math.max(0, song.analytics.weeklyFavorites - 1);
                break;
        }

        // Calculate new trending score: (Plays × 1) + (Downloads × 2) + (Favorites × 1.5)
        if (interactionType !== 'seek') {
            const newPlays = updateData['analytics.weeklyPlays'] || song.analytics.weeklyPlays;
            const newDownloads = updateData['analytics.weeklyDownloads'] || song.analytics.weeklyDownloads;
            const newFavorites = updateData['analytics.weeklyFavorites'] || song.analytics.weeklyFavorites;
            
            updateData['analytics.trendingScore'] = (newPlays * 1) + (newDownloads * 2) + (newFavorites * 1.5);
            updateData['analytics.lastTrendingUpdate'] = new Date();
        }

        // Update the song
        await Song.findByIdAndUpdate(songId, { $set: updateData });

        res.json({ 
            message: 'Interaction tracked successfully',
            trendingScore: updateData['analytics.trendingScore'] || song.analytics.trendingScore
        });

    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({ message: 'Server error while tracking interaction' });
    }
};

// Get trending songs
exports.getTrendingSongs = async (req, res) => {
    try {
        const trendingSongs = await Song.find({
            'analytics.trendingScore': { $gt: 0 }
        })
        .populate('genres', 'name')
        .populate('subGenres', 'name')
        .populate('instruments', 'name')
        .sort({ 'analytics.trendingScore': -1 })
        .limit(12)
        .lean(); // faster, no hydration

        if (trendingSongs.length < 10) {
            return res.json([]);
        }

        res.json(trendingSongs);
    } catch (error) {
        console.error('Error fetching trending songs:', error);
        res.status(500).json({ message: 'Server error while fetching trending songs' });
    }
};

// Get new songs
exports.getNewSongs = async (req, res) => {
    try {
        const sinceDays = parseInt(req.query.sinceDays, 10) || 10;
        const limit = parseInt(req.query.limit, 10) || 12;
        const fromDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

        const newSongs = await Song.find({
            createdAt: { $gte: fromDate }
        })
        .populate('genres', 'name')
        .populate('subGenres', 'name')
        .populate('instruments', 'name')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(); // faster, no hydration

        return res.json(newSongs);
    } catch (error) {
        console.error('Error fetching new songs:', error);
        res.status(500).json({ message: 'Server error while fetching new songs' });
    }
};

