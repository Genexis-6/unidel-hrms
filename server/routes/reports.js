const express    = require('express');
const Staff      = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Promotion  = require('../models/Promotion');
const Payroll    = require('../models/Payroll');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('superadmin','registrar','bursary'));

// GET /api/reports/attendance-summary?from=&to=&department=
router.get('/attendance-summary', async (req, res, next) => {
  try {
    const { from, to, department } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const match = { ...(Object.keys(dateFilter).length && { date: dateFilter }) };

    const byStatus = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byDept = await Attendance.aggregate([
      { $match: match },
      { $lookup: { from: 'staff', localField: 'staff', foreignField: '_id', as: 'staffInfo' } },
      { $unwind: '$staffInfo' },
      ...(department ? [{ $match: { 'staffInfo.department': department } }] : []),
      { $group: {
        _id: { dept: '$staffInfo.department', status: '$status' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.dept': 1 } },
    ]);

    const dailyTrend = await Attendance.aggregate([
      { $match: { ...match, status: { $in: ['Present','Half-Day'] } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]);

    res.json({ success: true, data: { byStatus, byDept, dailyTrend } });
  } catch (err) { next(err); }
});

// GET /api/reports/payroll-summary?year=2026
router.get('/payroll-summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const monthly = await Payroll.aggregate([
      { $match: { year } },
      { $group: {
        _id: '$month',
        totalGross: { $sum: '$grossSalary' },
        totalNet:   { $sum: '$netSalary' },
        totalTax:   { $sum: '$tax' },
        count:      { $sum: 1 },
        flagged:    { $sum: { $cond: ['$flagged', 1, 0] } },
      }},
      { $sort: { _id: 1 } },
    ]);

    const byDept = await Payroll.aggregate([
      { $match: { year } },
      { $lookup: { from: 'staff', localField: 'staff', foreignField: '_id', as: 'staffInfo' } },
      { $unwind: '$staffInfo' },
      { $group: {
        _id: '$staffInfo.department',
        totalGross: { $sum: '$grossSalary' },
        count: { $sum: 1 },
      }},
      { $sort: { totalGross: -1 } },
    ]);

    res.json({ success: true, data: { monthly, byDept, year } });
  } catch (err) { next(err); }
});

// GET /api/reports/promotion-summary
router.get('/promotion-summary', async (req, res, next) => {
  try {
    const [byStatus, byDept, avgScore] = await Promise.all([
      Promotion.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Promotion.aggregate([
        { $lookup: { from: 'staff', localField: 'staff', foreignField: '_id', as: 'staffInfo' } },
        { $unwind: '$staffInfo' },
        { $group: { _id: '$staffInfo.department', count: { $sum: 1 }, avgAiScore: { $avg: '$aiScore' } } },
        { $sort: { count: -1 } },
      ]),
      Promotion.aggregate([{ $group: { _id: null, avg: { $avg: '$aiScore' }, min: { $min: '$aiScore' }, max: { $max: '$aiScore' } } }]),
    ]);
    res.json({ success: true, data: { byStatus, byDept, scoreStats: avgScore[0] } });
  } catch (err) { next(err); }
});

// GET /api/reports/dashboard-kpis — all KPIs for dashboard in one call
router.get('/dashboard-kpis', async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);

    const [
      totalStaff, todayAttendance, pendingLeave, pendingPromo,
      flaggedPayroll, recentActivity,
    ] = await Promise.all([
      Staff.countDocuments({ isActive: true, status: 'Active' }),
      Attendance.aggregate([
        { $match: { date: { $gte: today, $lte: todayEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Leave.countDocuments({ status: 'Pending' }),
      Promotion.countDocuments({ status: { $in: ['Pending','AI-Approved'] } }),
      Payroll.countDocuments({ flagged: true }),
      // last 10 activities across leave + promotion
      Promise.all([
        Leave.find({ status: 'Pending' }).populate('staff','firstName lastName').sort({ createdAt: -1 }).limit(5),
        Promotion.find({}).populate('staff','firstName lastName').sort({ updatedAt: -1 }).limit(5),
      ]),
    ]);

    const [recentLeave, recentPromo] = recentActivity;

    res.json({
      success: true,
      data: {
        totalStaff,
        todayAttendance,
        pendingLeave,
        pendingPromo,
        flaggedPayroll,
        recentLeave,
        recentPromo,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
