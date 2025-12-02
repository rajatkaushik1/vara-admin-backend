/**
 * Purpose: Admin-only CRUD to manage "pannels" (sub-admin accounts).
 * Model: Reuse ../models/User.js
 * - role must be 'editor' for sub-admins
 * - name will store the panelName
 * - username is the loginId
 * - email is auto-generated as `${loginId}@panel.local` (ensure uniqueness; append +1, +2 if needed)
 * - password is hashed by User model's pre-save hook
 */

const User = require('../models/User');

async function generateUniqueEmail(baseLoginId) {
  const sanitize = (s) => String(s || '').trim().toLowerCase();
  const base = `${sanitize(baseLoginId)}@panel.local`;

  // If no conflict, return base
  let candidate = base;
  let counter = 1;

  // Loop until unique (upper bound to avoid infinite loops)
  while (await User.findOne({ email: candidate })) {
    candidate = `${sanitize(baseLoginId)}+${counter}@panel.local`;
    counter += 1;
    if (counter > 1000) throw new Error('Failed to generate unique email for panel user');
  }
  return candidate;
}

// GET /api/panels
// List all sub-admins (role: 'editor')
exports.listPanels = async (req, res) => {
  try {
    const users = await User.find({ role: 'editor' })
      .select('_id username email name role createdAt updatedAt')
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (err) {
    console.error('listPanels error:', err?.message || err);
    return res.status(500).json({ message: 'Server error listing panels' });
  }
};

// POST /api/panels
// Create a new sub-admin panel
exports.createPanel = async (req, res) => {
  try {
    const { panelName, loginId, password } = req.body || {};
    if (!panelName || !loginId || !password) {
      return res.status(400).json({ message: 'panelName, loginId, and password are required' });
    }

    const username = String(loginId).trim();
    const name = String(panelName).trim();

    // Ensure username uniqueness
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: 'loginId is already taken' });
    }

    // Generate unique email based on login
    const email = await generateUniqueEmail(username);

    const user = new User({
      username,
      password,
      email,
      name,      // store panelName into "name"
      role: 'editor'
    });

    await user.save();

    return res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error('createPanel error:', err?.message || err);
    return res.status(500).json({ message: 'Server error creating panel', error: err?.message || String(err) });
  }
};

// PATCH /api/panels/:id
// Update loginId and/or panelName
exports.updatePanelInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { panelName, loginId } = req.body || {};

    const user = await User.findById(id);
    if (!user || user.role !== 'editor') {
      return res.status(404).json({ message: 'Panel not found' });
    }

    // Update name (panelName)
    if (typeof panelName !== 'undefined') {
      const name = String(panelName).trim();
      if (!name) {
        return res.status(400).json({ message: 'panelName cannot be empty' });
      }
      user.name = name;
    }

    // Update username (loginId) + regenerate unique email
    if (typeof loginId !== 'undefined') {
      const nextUsername = String(loginId).trim();
      if (!nextUsername) {
        return res.status(400).json({ message: 'loginId cannot be empty' });
      }
      if (nextUsername !== user.username) {
        const conflict = await User.findOne({ username: nextUsername, _id: { $ne: user._id } });
        if (conflict) {
          return res.status(409).json({ message: 'loginId is already taken' });
        }
        user.username = nextUsername;
        user.email = await generateUniqueEmail(nextUsername);
      }
    }

    await user.save();

    return res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      updatedAt: user.updatedAt
    });
  } catch (err) {
    console.error('updatePanelInfo error:', err?.message || err);
    return res.status(500).json({ message: 'Server error updating panel', error: err?.message || String(err) });
  }
};

// PATCH /api/panels/:id/password
// Update password for a sub-admin
exports.updatePanelPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({ message: 'Password is required (min 4 chars)' });
    }

    const user = await User.findById(id);
    if (!user || user.role !== 'editor') {
      return res.status(404).json({ message: 'Panel not found' });
    }

    user.password = String(password).trim(); // will be hashed by pre-save
    await user.save();

    return res.json({ ok: true, message: 'Password updated' });
  } catch (err) {
    console.error('updatePanelPassword error:', err?.message || err);
    return res.status(500).json({ message: 'Server error updating password', error: err?.message || String(err) });
  }
};

// DELETE /api/panels/:id
// Delete a sub-admin panel (does NOT delete their songs)
exports.deletePanel = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.role !== 'editor') {
      return res.status(404).json({ message: 'Panel not found' });
    }

    await user.deleteOne();

    return res.json({ ok: true, message: 'Panel deleted' });
  } catch (err) {
    console.error('deletePanel error:', err?.message || err);
    return res.status(500).json({ message: 'Server error deleting panel', error: err?.message || String(err) });
  }
};
