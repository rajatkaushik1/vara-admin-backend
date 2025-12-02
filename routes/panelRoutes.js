/**
 * You are creating a NEW FILE at: vara-admin-backend/routes/panelRoutes.js
 * Purpose: Expose admin-only CRUD routes for managing "pannels" (sub-admins).
 * Middleware: require logged-in user with role 'admin'
 *
 * Endpoints:
 * - GET    /api/panels                 → listPanels
 * - POST   /api/panels                 → createPanel
 * - PATCH  /api/panels/:id             → updatePanelInfo
 * - PATCH  /api/panels/:id/password    → updatePanelPassword
 * - DELETE /api/panels/:id             → deletePanel
 *
 * Very important: Don’t change any other file or function in the project.
 */

const express = require('express');
const router = express.Router();

const {
  listPanels,
  createPanel,
  updatePanelInfo,
  updatePanelPassword,
  deletePanel
} = require('../controllers/panelController');

const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Admin-only guard for all routes in this file
router.use(verifyToken, requireRole('admin'));

// Routes
router.get('/', listPanels);
router.post('/', createPanel);
router.patch('/:id', updatePanelInfo);
router.patch('/:id/password', updatePanelPassword);
router.delete('/:id', deletePanel);

module.exports = router;
