const express    = require('express');
const Attendance = require('../models/Attendance');
const Staff      = require('../models/Staff');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../utils/auditHelper');

const router = express.Router();
router.use(protect);

// GET /api/attendance
router.get('/', async (req, res, next) => {
  try {
    const { date, department, staffId, month, year } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date); d.setHours(0,0,0,0);
      const d2 = new Date(d); d2.setHours(23,59,59,999);
      filter.date = { $gte: d, $lte: d2 };
    } else if (month && year) {
      filter.date = { $gte: new Date(year, month-1, 1), $lte: new Date(year, month, 0, 23,59,59) };
    }
    if (staffId) filter.staff = staffId;
    let records = await Attendance.find(filter)
      .populate('staff', 'firstName lastName staffId department category')
      .sort({ date: -1 });
    if (department) records = records.filter(r => r.staff?.department === department);
    res.json({ success: true, data: records, total: records.length });
  } catch (err) { next(err); }
});

// GET /api/attendance/summary
router.get('/summary', async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    date.setHours(0,0,0,0);
    const dateEnd = new Date(date); dateEnd.setHours(23,59,59,999);
    const [summary, totalStaff] = await Promise.all([
      Attendance.aggregate([{ $match: { date: { $gte: date, $lte: dateEnd } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Staff.countDocuments({ status: 'Active', isActive: true }),
    ]);
    res.json({ success: true, data: { summary, totalStaff, date } });
  } catch (err) { next(err); }
});

// GET /api/attendance/anomalies
router.get('/anomalies', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const flagged = await Attendance.find({ flagged: true })
      .populate('staff', 'firstName lastName staffId department')
      .sort({ date: -1 }).limit(50);
    res.json({ success: true, data: flagged });
  } catch (err) { next(err); }
});

// GET /api/attendance/staff/:staffId
router.get('/staff/:staffId', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { staff: req.params.staffId };
    if (from || to) { filter.date = {}; if (from) filter.date.$gte = new Date(from); if (to) filter.date.$lte = new Date(to); }
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(365);
    const present = records.filter(r => ['Present','Half-Day'].includes(r.status)).length;
    res.json({ success: true, data: records, stats: { total: records.length, present, rate: records.length ? Math.round((present/records.length)*100) : 0 } });
  } catch (err) { next(err); }
});

// POST /api/attendance/clockin
router.post('/clockin', async (req, res, next) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ success: false, message: 'staffId is required.' });
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
    const timeStr = new Date().toTimeString().slice(0,5);
    const record = await Attendance.findOneAndUpdate(
      { staff: staffId, date: { $gte: today, $lte: todayEnd } },
      { $set: { staff: staffId, date: today, status: 'Present', checkIn: timeStr, markedBy: req.user._id } },
      { upsert: true, new: true }
    );
    await audit({ user: req.user, action: 'CLOCK_IN', module: 'Attendance', description: `Clocked in ${staff.firstName} ${staff.lastName} at ${timeStr}`, resourceId: record._id, resourceType: 'Attendance', ip: req.ip });
    res.json({ success: true, data: record, message: `Clock-in recorded at ${timeStr}` });
  } catch (err) { next(err); }
});

// POST /api/attendance/clockout
router.post('/clockout', async (req, res, next) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ success: false, message: 'staffId is required.' });
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
    const timeStr = new Date().toTimeString().slice(0,5);
    const record = await Attendance.findOneAndUpdate(
      { staff: staffId, date: { $gte: today, $lte: todayEnd } },
      { $set: { checkOut: timeStr } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'No clock-in record found for today.' });
    let hoursWorked = null;
    if (record.checkIn) {
      const [inH, inM] = record.checkIn.split(':').map(Number);
      const [outH, outM] = timeStr.split(':').map(Number);
      hoursWorked = ((outH*60+outM)-(inH*60+inM))/60;
    }
    await audit({ user: req.user, action: 'CLOCK_OUT', module: 'Attendance', description: `Clock-out for staffId ${staffId} at ${timeStr}`, resourceId: record._id, resourceType: 'Attendance', ip: req.ip });
    res.json({ success: true, data: record, hoursWorked, message: `Clock-out recorded at ${timeStr}` });
  } catch (err) { next(err); }
});

// POST /api/attendance — bulk mark
router.post('/', async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    const date = new Date(records[0]?.date || Date.now()); date.setHours(0,0,0,0);
    const ops = records.map(r => ({
      updateOne: {
        filter: { staff: r.staff, date },
        update: { $set: { status: r.status, checkIn: r.checkIn||null, checkOut: r.checkOut||null, markedBy: req.user._id, note: r.note } },
        upsert: true,
      },
    }));
    const result = await Attendance.bulkWrite(ops);
    await audit({ user: req.user, action: 'BULK_MARK_ATTENDANCE', module: 'Attendance', description: `Bulk attendance for ${records.length} staff on ${date.toDateString()}`, ip: req.ip });
    res.json({ success: true, message: `${result.upsertedCount + result.modifiedCount} records saved.` });
  } catch (err) { next(err); }
});

module.exports = router;
