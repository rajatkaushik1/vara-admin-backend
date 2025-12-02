const Batch = require('../models/Batch');

/**
 * Create a new batch
 * POST /api/batches
 * Body: { name: string }
 */
exports.createBatch = async (req, res) => {
  try {
    const rawName = (req.body && req.body.name ? String(req.body.name) : '').trim();
    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Batch name is required.' });
    }

    // Case-insensitive uniqueness check
    const exists = await Batch.findOne({ name: rawName }).collation({ locale: 'en', strength: 2 });
    if (exists) {
      return res.status(409).json({ success: false, error: `Batch "${rawName}" already exists.` });
    }

    const batch = await Batch.create({ name: rawName });
    return res.status(201).json(batch);
  } catch (err) {
    // E11000 (duplicate key) or other server error
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, error: 'A batch with this name already exists.' });
    }
    console.error('Error creating batch:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error while creating batch.' });
  }
};

/**
 * List batches
 * GET /api/batches
 */
exports.getAllBatches = async (req, res) => {
  try {
    const items = await Batch.find({}).sort({ name: 1 });
    return res.status(200).json(items);
  } catch (err) {
    console.error('Error fetching batches:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error while fetching batches.' });
  }
};
