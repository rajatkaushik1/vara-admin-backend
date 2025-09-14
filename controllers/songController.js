// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const SongAnalytics = require('../models/SongAnalytics');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { bump } = require('../utils/contentVersion');

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
 * Parse JSON stringified arrays from FormData fields (genres, subGenres, instruments, moods).
 * Falls back to a single-value array if parsing fails.
 */
const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [value];
  }
};

/**
 * Extract Cloudinary public_id from URL (best-effort).
 */
const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/');
    const publicIdWithFormat = parts[parts.length - 1];
    const public_id = publicIdWithFormat.split('.')[0];
    const folder = parts[parts.length - 2];
    return `${folder}/${public_id}`;
  } catch (e) {
    console.error('Could not extract public_id from URL:', url);
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
      .populate('moods', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json(songs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Create a new song (expects multipart with files: image, audio)
exports.createSong = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }

  if (!req.files || !req.files.image || !req.files.audio) {
    return res.status(400).json({ ok: false, message: 'Image and audio files are required' });
  }

  const { title, duration, genres, subGenres, instruments, moods, collectionType, hasVocals, bpm, key } = req.body;

  try {
    const imageFile = req.files.image[0];
    const audioFile = req.files.audio[0];

    const imageUrl = imageFile.path;

    const base = (process.env.R2_PUBLIC_BASE_URL && process.env.R2_PUBLIC_BASE_URL.trim())
      ? process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')
      : '';

    let audioUrl = '';
    if (base && audioFile.key) {
      audioUrl = `${base}/${audioFile.key}`;
    } else if (audioFile.location) {
      audioUrl = audioFile.location;
    } else if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_BUCKET_NAME && audioFile.key) {
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
      moods: parseJsonArray(moods), // NEW
      collectionType,
      imageUrl,
      audioUrl,
      audioKey: audioFile.key || undefined,
      hasVocals: String(hasVocals).toLowerCase() === 'true',
      bpm,
      key
    });

    const saved = await newSong.save();

    const populated = await Song.findById(saved._id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name');

    try { await bump('songs'); } catch (e) { console.warn('content version bump failed (createSong):', e?.message || e); }
    return res.status(201).json({ ok: true, song: populated || saved });
  } catch (err) {
    console.error('Error in createSong:', err);
    return res.status(500).json({ ok: false, message: 'Server Error while creating song', error: err.message });
  }
};

// Update an existing song (JSON body; no file uploads here)
exports.updateSong = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, genres, subGenres, instruments, moods, collectionType, hasVocals, bpm, key } = req.body;

  const updateData = {
    title,
    genres,
    subGenres,
    instruments,
    moods, // NEW
    collectionType,
    hasVocals,
    bpm,
    key
  };

  // Remove undefined fields so we don't overwrite existing values
  Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);

  try {
    const song = await Song.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name');

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    try { await bump('songs'); } catch (e) { console.warn('content version bump failed (updateSong):', e?.message || e); }
    res.json(song);
  } catch (err) {
    console.error('Error in updateSong:', err);
    res.status(500).send('Server Error');
  }
};

// Delete a song (also deletes Cloudinary image and R2 audio; best-effort)
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

        // Prefer saved audioKey; derive from URL if missing
        let key = song.audioKey;

        if (!key) {
          const extractKey = (urlStr) => {
            try {
              const u = new URL(urlStr);
              let path = u.pathname.replace(/^\/+/, ''); // strip leading slash
              if (bucketName && path.startsWith(bucketName + '/')) {
                path = path.slice(bucketName.length + 1);
              }
              return path;
            } catch {
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

    await song.deleteOne();

    try { await bump('songs'); } catch (e) { console.warn('content version bump failed (deleteSong):', e?.message || e); }
    return res.json({ message: 'Song and associated files removed' });
  } catch (err) {
    console.error('Error in deleteSong:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// Track user interactions (play, download, favorite, unfavorite, seek)
exports.trackInteraction = async (req, res) => {
  try {
    const { songId } = req.params;
    const { interactionType, playData, seekData, userId, userEmail, metadata } = req.body;

    if (!interactionType || !userId) {
      return res.status(400).json({ message: 'interactionType and userId are required' });
    }

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

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

    const updateData = {};

    switch (interactionType) {
      case 'play':
        updateData['analytics.totalPlays'] = song.analytics.totalPlays + 1;
        updateData['analytics.weeklyPlays'] = song.analytics.weeklyPlays + 1;
        updateData['analytics.lastPlayedAt'] = new Date();

        if (playData && playData.duration) {
          const additionalHours = playData.duration / 3600;
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

      default:
        break;
    }

    if (interactionType !== 'seek') {
      const newPlays = updateData['analytics.weeklyPlays'] || song.analytics.weeklyPlays;
      const newDownloads = updateData['analytics.weeklyDownloads'] || song.analytics.weeklyDownloads;
      const newFavorites = updateData['analytics.weeklyFavorites'] || song.analytics.weeklyFavorites;

      updateData['analytics.trendingScore'] = (newPlays * 1) + (newDownloads * 2) + (newFavorites * 1.5);
      updateData['analytics.lastTrendingUpdate'] = new Date();
    }

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
      .populate('moods', 'name')
      .sort({ 'analytics.trendingScore': -1 })
      .limit(12)
      .lean();

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
      .populate('moods', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json(newSongs);
  } catch (error) {
    console.error('Error fetching new songs:', error);
    res.status(500).json({ message: 'Server error while fetching new songs' });
  }
};

