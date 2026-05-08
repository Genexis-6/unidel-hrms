const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Staff   = require('../models/Staff');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/staff — list with pagination, search, filter
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      search, department, category, status, gradeLevel,
    } = req.query;

    const filter = { isActive: true };
    if (department) filter.department = department;
    if (category)   filter.category   = category;
    if (status)     filter.status     = status;
    if (gradeLevel) filter.gradeLevel = gradeLevel;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { staffId:   { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (page - 1) * limit;
    const total = await Staff.countDocuments(filter);
    const staff = await Staff.find(filter)
      .select('-__v')
      .sort({ lastName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: staff,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit), limit: parseInt(limit) },
    });
  } catch (err) { next(err); }
});

// GET /api/staff/stats — summary counts
router.get('/stats', async (req, res, next) => {
  try {
    const [total, byCategory, byDept, byStatus] = await Promise.all([
      Staff.countDocuments({ isActive: true }),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    res.json({ success: true, data: { total, byCategory, byDept, byStatus } });
  } catch (err) { next(err); }
});

// GET /api/staff/:id
router.get('/:id', async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// POST /api/staff
router.post('/', authorize('superadmin','registrar'), [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').isEmail(),
  body('department').notEmpty(),
  body('category').isIn(['Academic','Administrative','Technical']),
  body('gradeLevel').notEmpty(),
  body('dateOfEmployment').isISO8601(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const staff = await Staff.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// PUT /api/staff/:id
router.put('/:id', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// DELETE /api/staff/:id (soft delete)
router.delete('/:id', authorize('superadmin'), async (req, res, next) => {
  try {
    await Staff.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Staff record deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
