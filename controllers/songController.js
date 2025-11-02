// vara-admin-backend/controllers/songController.js

const Song = require('../models/Song');
const SongAnalytics = require('../models/SongAnalytics');
const { validationResult } = require('express-validator');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { bump } = require('../utils/contentVersion');
const jwt = require('jsonwebtoken');

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// --- R2 public base (prefer R2_PUBLIC_URL) and helpers ---
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_PUBLIC = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

function buildPublicUrlFromKey(key) {
  if (!key) return '';
  if (R2_PUBLIC) return `${R2_PUBLIC}/${key}`;
  // Fallback to direct endpoint if no public base configured
  return `https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

function r2KeyFromUrl(url) {
  try {
    if (!url) return null;
    if (R2_PUBLIC && url.startsWith(R2_PUBLIC)) {
      const key = url.slice(R2_PUBLIC.length).replace(/^\//, '');
      return key || null;
    }
    const u = new URL(url);
    // pathname like: /<bucket>/<key...>
    let p = u.pathname.replace(/^\//, '');
    if (p.startsWith(R2_BUCKET + '/')) p = p.slice(R2_BUCKET.length + 1);
    return p || null;
  } catch {
    return null;
  }
}

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
// CHANGE: If req.user exists and role === 'editor', return only songs created by that user.
// Otherwise return all (public/admin).
exports.getAllSongs = async (req, res) => {
  try {
    const filter = {};
    if (req.user && req.user.role === 'editor') {
      filter.createdBy = req.user._id;
    }

    const songs = await Song.find(filter)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .populate('batch', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json(songs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Create a new song (expects multipart with files: image, audio)
// CHANGE: Tag the song with createdBy = req.user._id (if present).
exports.createSong = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }

  if (!req.files || !req.files.image || !req.files.audio) {
    return res.status(400).json({ ok: false, message: 'Image and audio files are required' });
  }

  const { title, duration, genres, subGenres, instruments, moods, collectionType, hasVocals, bpm, key, externalSongId, batchId } = req.body;

  const imageFile = req.files.image[0];
  const audioFile = req.files.audio[0];

  // Build image URL from R2 key (multer-s3)
  const imageUrl = imageFile && imageFile.key ? buildPublicUrlFromKey(imageFile.key) : '';

  // Build audio URL (prefer public base + key, else location, else endpoint fallback)
  let audioUrl = '';
  if (audioFile && audioFile.key) {
    audioUrl = buildPublicUrlFromKey(audioFile.key);
  } else if (audioFile && audioFile.location) {
    audioUrl = audioFile.location;
  } else if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_BUCKET_NAME && audioFile && audioFile.key) {
    audioUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${audioFile.key}`;
  }

  if (!imageUrl || !audioUrl) {
    return res.status(500).json({ ok: false, message: 'Could not determine image/audio URL after upload' });
  }

  const batchObjectId = (batchId && /^[0-9a-fA-F]{24}$/.test(batchId)) ? batchId : undefined;

  // Determine creator (robust): prefer req.user, else decode Authorization token
  let creatorId = (req.user && req.user._id) ? req.user._id : null;
  if (!creatorId) {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (auth && typeof auth === 'string') {
      const parts = auth.split(' ');
      if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
        try {
          const decoded = jwt.verify(parts[1].trim(), process.env.JWT_SECRET);
          if (decoded && decoded.id) {
            creatorId = decoded.id;
          }
        } catch (_) {
          // ignore
        }
      }
    }
  }

  const newSong = new Song({
    title: title && typeof title === 'string' ? title : '',
    duration: Number(duration) || 0,
    genres: parseJsonArray(genres),
    subGenres: parseJsonArray(subGenres),
    instruments: parseJsonArray(instruments),
    moods: parseJsonArray(moods),
    collectionType,
    imageUrl, // R2 public URL
    audioUrl, // R2 public URL
    audioKey: audioFile.key || undefined,
    hasVocals: String(hasVocals).toLowerCase() === 'true',
    bpm,
    key,
    externalSongId: externalSongId && typeof externalSongId === 'string' ? externalSongId.trim() : undefined,
    batch: batchObjectId,
    createdBy: creatorId || null,
  });

  try {
    const saved = await newSong.save();

    const populated = await Song.findById(saved._id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .populate('batch', 'name');

    try { await bump('songs'); } catch (e) { console.warn('content version bump failed (createSong):', e?.message || e); }
    return res.status(201).json({ ok: true, song: populated || saved });
  } catch (err) {
    console.error('Error in createSong:', err);
    return res.status(500).json({ ok: false, message: 'Server Error while creating song', error: err.message });
  }
};

// Update an existing song (JSON body only; no file uploads here)
// CHANGE: If req.user.role === 'editor', ensure the song.createdBy matches req.user._id.
exports.updateSong = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid song id format' });
    }

    const {
      title,
      genres,
      subGenres,
      instruments,
      moods,
      collectionType,
      hasVocals,
      bpm,
      key,
      externalSongId,
      batchId,
      batch
    } = req.body || {};

    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // NEW: ownership enforcement for sub-admins
    if (req.user && req.user.role === 'editor') {
      if (!song.createdBy || String(song.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: you can only edit songs you created' });
      }
    }

    if (typeof title !== 'undefined') song.title = title;

    if (typeof bpm !== 'undefined') song.bpm = bpm;
    if (typeof key !== 'undefined') song.key = key;
    if (typeof hasVocals !== 'undefined') song.hasVocals = hasVocals;
    if (typeof collectionType !== 'undefined') song.collectionType = collectionType;

    if (typeof genres !== 'undefined') {
      song.genres = Array.isArray(genres) ? genres : (genres === null ? [] : genres);
    }
    if (typeof subGenres !== 'undefined') {
      song.subGenres = Array.isArray(subGenres) ? subGenres : (subGenres === null ? [] : subGenres);
    }
    if (typeof instruments !== 'undefined') {
      song.instruments = Array.isArray(instruments) ? instruments : (instruments === null ? [] : instruments);
    }
    if (typeof moods !== 'undefined') {
      song.moods = Array.isArray(moods) ? moods : (moods === null ? [] : moods);
    }

    if (typeof externalSongId !== 'undefined') {
      song.externalSongId = (externalSongId || '').trim();
    }

    const incomingBatch = (typeof batchId !== 'undefined') ? batchId
                        : (typeof batch !== 'undefined') ? batch
                        : undefined;

    if (typeof incomingBatch !== 'undefined') {
      if (incomingBatch && /^[0-9a-fA-F]{24}$/.test(incomingBatch)) {
        song.batch = incomingBatch;
      } else if (incomingBatch === '' || incomingBatch === null) {
        song.batch = null;
      } else {
        return res.status(400).json({ message: 'Invalid batchId format' });
    }

    }

    await song.save();

    const populated = await Song.findById(song._id)
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .populate({ path: 'batch', select: 'name', strictPopulate: false });

    try { await bump('songs'); } catch (e) {
      console.warn('content version bump failed (updateSong):', e?.message || e);
    }

    return res.json(populated || song);
  } catch (err) {
    console.error('Error in updateSong:', err);
    return res.status(500).json({
      message: 'Server Error while updating song',
      error: err && err.message ? err.message : String(err),
      name: err && err.name ? err.name : undefined
    });
  }
};

// Delete a song (also deletes R2 image and R2 audio; best-effort)
// CHANGE: If req.user.role === 'editor', ensure ownership before deletion.
exports.deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Ownership enforcement for sub-admins
    if (req.user && req.user.role === 'editor') {
      if (!song.createdBy || String(song.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: you can only delete songs you created' });
      }
    }

    // Delete cover image from R2 (best-effort)
    if (song.imageUrl) {
      try {
        const imgKey = r2KeyFromUrl(song.imageUrl);
        if (imgKey) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: imgKey }));
        }
      } catch (imgErr) {
        console.warn('Failed to delete image from R2 (continuing):', imgErr?.message || imgErr);
      }
    }

    // Delete audio from R2 (best-effort)
    if (song.audioUrl) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME;
        let key = song.audioKey;

        if (!key) {
          // Derive from URL if audioKey wasn't stored
          const extractKey = (urlStr) => {
            try {
              const u = new URL(urlStr);
              let p = u.pathname.replace(/^\//, '');
              if (bucketName && p.startsWith(bucketName + '/')) {
                p = p.slice(bucketName.length + 1);
              }
              return p;
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

///// APPEND BELOW THIS LINE /////

// Get only the current user's songs (strict auth required upstream)
exports.getMySongs = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const songs = await Song.find({ createdBy: req.user._id })
      .populate('genres', 'name')
      .populate('subGenres', 'name')
      .populate('instruments', 'name')
      .populate('moods', 'name')
      .populate('batch', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(songs);
  } catch (err) {
    console.error('getMySongs error:', err?.message || err);
    return res.status(500).json({ message: 'Server error while fetching your songs' });
  }
};

// Don’t change any other function in this file.

