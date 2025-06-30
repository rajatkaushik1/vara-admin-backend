// C:\Users\Dell\Desktop\vara-admin\controllers\songController.js
const Song = require('../models/Song');
const Genre = require('../models/Genre');
const SubGenre = require('../models/SubGenre');
const fs = require('fs');
const path = require('path');

// Upload a new song
exports.uploadSong = async (req, res) => {
  const { title, genres, subGenres, isExclusive, collectionType } = req.body;

  let imagePath = null;
  let audioPath = null;

  const uploadBaseDir = path.join(__dirname, '../uploads');

  if (req.files && req.files.image && req.files.image.length > 0) {
    imagePath = path.relative(uploadBaseDir, req.files.image[0].path).replace(/\\/g, '/');
  }
  if (req.files && req.files.audio && req.files.audio.length > 0) {
    audioPath = path.relative(uploadBaseDir, req.files.audio[0].path).replace(/\\/g, '/');
  }

  if (!imagePath || !audioPath) {
    if (req.files.image && req.files.image.length > 0 && fs.existsSync(req.files.image[0].path)) {
        fs.unlinkSync(req.files.image[0].path);
    }
    if (req.files.audio && req.files.audio.length > 0 && fs.existsSync(req.files.audio[0].path)) {
        fs.unlinkSync(req.files.audio[0].path);
    }
    return res.status(400).json({ success: false, error: 'Both image and audio files are required.' });
  }

  try {
    const genrePromises = Array.isArray(genres) ? genres.map(id => Genre.findById(id)) : [];
    const subGenrePromises = Array.isArray(subGenres) ? subGenres.map(id => SubGenre.findById(id)) : [];

    const existingGenres = await Promise.all(genrePromises);
    const existingSubGenres = await Promise.all(subGenrePromises);

    if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
        if (req.files.image && req.files.image.length > 0 && fs.existsSync(req.files.image[0].path)) {
            fs.unlinkSync(req.files.image[0].path);
        }
        if (req.files.audio && req.files.audio.length > 0 && fs.existsSync(req.files.audio[0].path)) {
            fs.unlinkSync(req.files.audio[0].path);
        }
        return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid.' });
    }

    const song = new Song({
      title,
      imagePath,
      audioPath,
      genres,
      subGenres,
      isExclusive: isExclusive === 'true',
      collectionType
    });

    await song.save();
    res.status(201).json(song);
  } catch (error) {
    console.error("Error uploading song:", error);
    if (req.files.image && req.files.image.length > 0 && fs.existsSync(req.files.image[0].path)) {
        fs.unlinkSync(req.files.image[0].path);
    }
    if (req.files.audio && req.files.audio.length > 0 && fs.existsSync(req.files.audio[0].path)) {
        fs.unlinkSync(req.files.audio[0].path);
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get all songs
exports.getAllSongs = async (req, res) => {
  try {
    const songs = await Song.find()
        .populate('genres', 'name')
        .populate('subGenres', 'name');
    res.json(songs);
  } catch (error) {
    console.error("Error fetching all songs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a song by ID (including associated files)
exports.deleteSong = async (req, res) => {
    try {
        const { id } = req.params;

        const songToDelete = await Song.findById(id);

        if (!songToDelete) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        const uploadBaseDir = path.join(__dirname, '../uploads');

        if (songToDelete.imagePath) {
            const imageFullPath = path.join(uploadBaseDir, songToDelete.imagePath);
            if (fs.existsSync(imageFullPath)) {
                fs.unlink(imageFullPath, (err) => {
                    if (err) console.error("Failed to delete image file:", imageFullPath, err);
                });
            } else {
                console.warn("Image file not found on disk for deletion:", imageFullPath);
            }
        }

        if (songToDelete.audioPath) {
            const audioFullPath = path.join(uploadBaseDir, songToDelete.audioPath);
            if (fs.existsSync(audioFullPath)) {
                fs.unlink(audioFullPath, (err) => {
                    if (err) console.error("Failed to delete audio file:", audioFullPath, err);
                });
            } else {
                console.warn("Audio file not found on disk for deletion:", audioFullPath);
            }
        }

        await Song.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: 'Song and associated files deleted successfully.' });
    } catch (error) {
        console.error("Error deleting song and its files:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// NEW: Update a song by ID
exports.updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, genres, subGenres, isExclusive, collectionType } = req.body;

        const existingSong = await Song.findById(id);
        if (!existingSong) {
            return res.status(404).json({ success: false, error: 'Song not found.' });
        }

        const uploadBaseDir = path.join(__dirname, '../uploads');

        let newImagePath = existingSong.imagePath;
        if (req.files && req.files.image && req.files.image.length > 0) {
            if (existingSong.imagePath) {
                const oldImageFullPath = path.join(uploadBaseDir, existingSong.imagePath);
                if (fs.existsSync(oldImageFullPath)) {
                    fs.unlink(oldImageFullPath, (err) => {
                        if (err) console.error("Failed to delete old image file:", oldImageFullPath, err);
                    });
                }
            }
            newImagePath = path.relative(uploadBaseDir, req.files.image[0].path).replace(/\\/g, '/');
        }

        let newAudioPath = existingSong.audioPath;
        if (req.files && req.files.audio && req.files.audio.length > 0) {
            if (existingSong.audioPath) {
                const oldAudioFullPath = path.join(uploadBaseDir, existingSong.audioPath);
                if (fs.existsSync(oldAudioFullPath)) {
                    fs.unlink(oldAudioFullPath, (err) => {
                        if (err) console.error("Failed to delete old audio file:", oldAudioFullPath, err);
                    });
                }
            }
            newAudioPath = path.relative(uploadBaseDir, req.files.audio[0].path).replace(/\\/g, '/');
        }

        const genrePromises = Array.isArray(genres) ? genres.map(id => Genre.findById(id)) : [];
        const subGenrePromises = Array.isArray(subGenres) ? subGenres.map(id => SubGenre.findById(id)) : [];

        const existingGenres = await Promise.all(genrePromises);
        const existingSubGenres = await Promise.all(subGenrePromises);

        if (existingGenres.some(g => !g) || existingSubGenres.some(sg => !sg)) {
            if (req.files && req.files.image && req.files.image.length > 0) {
                fs.unlinkSync(req.files.image[0].path);
            }
            if (req.files && req.files.audio && req.files.audio.length > 0) {
                fs.unlinkSync(req.files.audio[0].path);
            }
            return res.status(404).json({ success: false, error: 'One or more provided Genre or SubGenre IDs are invalid for update.' });
        }

        const updatedSong = await Song.findByIdAndUpdate(
            id,
            {
                title,
                imagePath: newImagePath,
                audioPath: newAudioPath,
                genres: genres,
                subGenres: subGenres,
                isExclusive: isExclusive === 'true',
                collectionType
            },
            { new: true, runValidators: true }
        ).populate('genres', 'name').populate('subGenres', 'name');

        if (!updatedSong) {
            return res.status(404).json({ success: false, error: 'Song not found after update attempt.' });
        }

        res.status(200).json(updatedSong);
    } catch (error) {
        console.error("Error updating song:", error);
        if (req.files && req.files.image && req.files.image.length > 0 && fs.existsSync(req.files.image[0].path)) {
            fs.unlinkSync(req.files.image[0].path);
        }
        if (req.files && req.files.audio && req.files.audio.length > 0 && fs.existsSync(req.files.audio[0].path)) {
            fs.unlinkSync(req.files.audio[0].path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    uploadSong: exports.uploadSong,
    getAllSongs: exports.getAllSongs,
    deleteSong: exports.deleteSong,
    updateSong: exports.updateSong, // Export the new function
};