const express    = require('express');
const AuditLog   = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

// GET /api/audit?module=&action=&page=&limit=
router.get('/logs', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const { module, action, userId, status, page = 1, limit = 30, from, to } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (userId) filter.user   = userId;
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const total = await AuditLog.countDocuments(filter);
    const logs  = await AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, data: logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/audit/stats — summary counts by module
router.get('/logs/stats', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const [byModule, byAction, recent] = await Promise.all([
      AuditLog.aggregate([{ $group: { _id: '$module', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      AuditLog.find().populate('user','name role').sort({ createdAt: -1 }).limit(10),
    ]);
    res.json({ success: true, data: { byModule, byAction, recent } });
  } catch (err) { next(err); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

// GET /api/audit/notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    // Return notifications for this user OR broadcast notifications
    const filter = {
      $or: [
        { recipient: req.user._id },
        { recipient: null },
        { recipientRole: req.user.role },
      ],
    };
    const total = await Notification.countDocuments(filter);
    const data  = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const unread = await Notification.countDocuments({ ...filter, read: false });

    res.json({ success: true, data, total, unread, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// PUT /api/audit/notifications/:id/read
router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true, readAt: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /api/audit/notifications/read-all
router.put('/notifications/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ recipient: req.user._id }, { recipient: null }], read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
