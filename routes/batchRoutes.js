const express = require('express');
const router = express.Router();

const { createBatch, getAllBatches } = require('../controllers/batchController');
const cache = require('../middleware/cache');
const cacheControl = require('../middleware/cacheControl');

// Loader health endpoint — must be BEFORE other routes to ensure visibility
router.get('/health', (req, res) => {
  res.json({ ok: true, router: 'batches', ts: new Date().toISOString() });
});

// Create a new batch (JSON body: { name })
router.post('/', createBatch);

// Get all batches (cached)
router.get('/', cacheControl(600), cache(300), getAllBatches);

module.exports = router;
