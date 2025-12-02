const ContentVersion = require('../models/ContentVersion');

// Ensure a doc exists, return it.
// Uses 'key:global' as the single-record selector.
async function ensureDoc() {
  let doc = await ContentVersion.findOne({ key: 'global' });
  if (!doc) {
    const now = Date.now();
    doc = await ContentVersion.create({ key: 'global', v: now });
  }
  return doc;
}

// Bump the global version and optionally a specific type
// Allowed types: songs | genres | subgenres | instruments | moods
// Returns the new timestamp used.
async function bump(type) {
  const now = Date.now();
  const setObj = { v: now, updatedAt: new Date() };

  const allowed = ['songs', 'genres', 'subgenres', 'instruments', 'moods'];
  if (type && allowed.includes(type)) {
    setObj[type] = now;
  }

  // Upsert guarantees the doc exists and gets updated atomically.
  await ContentVersion.updateOne(
    { key: 'global' },
    { $set: setObj },
    { upsert: true }
  );

  return now;
}

// Read the current version snapshot (creates a doc if missing).
async function read() {
  const doc = await ensureDoc();
  return {
    v: doc.v || 0,
    songs: doc.songs || 0,
    genres: doc.genres || 0,
    subgenres: doc.subgenres || 0,
    instruments: doc.instruments || 0,
    moods: doc.moods || 0, // include moods in snapshot
    updatedAt: doc.updatedAt
  };
}

module.exports = { bump, read };
