const express    = require('express');
const Staff      = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Promotion  = require('../models/Promotion');
const Payroll    = require('../models/Payroll');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/dashboard — single call for all dashboard widgets
router.get('/', async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
    const now = new Date();

    const [
      totalStaff,
      todayAtt,
      pendingLeave,
      pendingPromo,
      flaggedPay,
      recentLeave,
      recentPromo,
      aiApprovedToday,
      deptBreakdown,
    ] = await Promise.all([
      Staff.countDocuments({ isActive: true }),
      Attendance.aggregate([
        { $match: { date: { $gte: today, $lte: todayEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Leave.countDocuments({ status: 'Pending' }),
      Promotion.countDocuments({ status: { $in: ['Pending','AI-Approved','Under-Review'] } }),
      Payroll.countDocuments({ flagged: true }),
      Leave.find({ status: 'Pending' })
        .populate('staff','firstName lastName department')
        .sort({ createdAt: -1 }).limit(5),
      Promotion.find({})
        .populate('staff','firstName lastName department gradeLevel')
        .sort({ updatedAt: -1 }).limit(5),
      Promotion.countDocuments({
        status: 'AI-Approved',
        aiVettedAt: { $gte: today, $lte: todayEnd },
      }),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const presentToday = todayAtt.find(a => a._id === 'Present')?.count || 0;
    const absentToday  = todayAtt.find(a => a._id === 'Absent')?.count  || 0;
    const halfDay      = todayAtt.find(a => a._id === 'Half-Day')?.count || 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalStaff,
          presentToday,
          absentToday,
          halfDay,
          attendanceRate: totalStaff > 0 ? Math.round(((presentToday + halfDay) / totalStaff) * 100) : 0,
          pendingLeave,
          pendingPromo,
          flaggedPay,
          aiApprovedToday,
        },
        recentLeave,
        recentPromo,
        deptBreakdown,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
