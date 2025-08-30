const express = require('express');
const router = express.Router();

/**
 * TEMPORARY STUB ROUTES FOR INSTRUMENTS
 * Purpose:
 * - Let the admin frontend render the "Manage Instruments" page without 404.
 * - GET returns an empty array so the UI shows "No instruments found" instead of an error.
 * - Write endpoints return 501 Not Implemented for now (we will replace in Step 3/4).
 */

// GET /api/instruments → empty list for now
router.get('/', async (req, res) => {
  try {
    return res.status(200).json([]);
  } catch (err) {
    return res.status(200).json([]); // keep GET harmless
  }
});

// POST /api/instruments → not implemented yet
router.post('/', (req, res) => {
  return res.status(501).json({ success: false, error: 'Instruments API: create not implemented yet (Step 3 will enable).' });
});

// PUT /api/instruments/:id → not implemented yet
router.put('/:id', (req, res) => {
  return res.status(501).json({ success: false, error: 'Instruments API: update not implemented yet (Step 3 will enable).' });
});

// DELETE /api/instruments/:id → not implemented yet
router.delete('/:id', (req, res) => {
  return res.status(501).json({ success: false, error: 'Instruments API: delete not implemented yet (Step 3 will enable).' });
});

module.exports = router;
