const express    = require('express');
const Attendance = require('../models/Attendance');
const Staff      = require('../models/Staff');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../utils/auditHelper');

const router = express.Router();
router.use(protect);

// ─── helpers ──────────────────────────────────────────────────────────────────
const dayRange = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0,0,0,0);
  const e = new Date(d); e.setHours(23,59,59,999);
  return { start: d, end: e };
};

// ─── GET /api/attendance ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { date, department, staffId, month, year } = req.query;
    const filter = {};

    if (date) {
      const { start, end } = dayRange(date);
      filter.date = { $gte: start, $lte: end };
    } else if (month && year) {
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }
    if (staffId) filter.staff = staffId;

    let records = await Attendance.find(filter)
      .populate('staff', 'firstName lastName staffId department category')
      .sort({ date: -1 });

    if (department) records = records.filter(r => r.staff?.department === department);

    res.json({ success: true, data: records, total: records.length });
  } catch (err) { next(err); }
});

// ─── GET /api/attendance/summary ─────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);
    const [summary, totalStaff] = await Promise.all([
      Attendance.aggregate([
        { $match: { date: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Staff.countDocuments({ status: 'Active', isActive: true }),
    ]);
    res.json({ success: true, data: { summary, totalStaff, date: start } });
  } catch (err) { next(err); }
});

// ─── GET /api/attendance/clock-stats?date=YYYY-MM-DD ─────────────────────────
// Returns total clock-ins and clock-outs for a given date, plus per-staff breakdown
router.get('/clock-stats', async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);

    const records = await Attendance.find({ date: { $gte: start, $lte: end } })
      .populate('staff', 'firstName lastName staffId department');

    const perStaff = records.map(r => ({
      staff:              r.staff,
      clockInCount:       r.clockInCount || 0,
      clockOutCount:      r.clockOutCount || 0,
      totalMinutesWorked: r.totalMinutesWorked || 0,
      checkIn:            r.checkIn,
      checkOut:           r.checkOut,
      clockEvents:        r.clockEvents || [],
      status:             r.status,
    }));

    const totalClockIns  = perStaff.reduce((s, r) => s + r.clockInCount, 0);
    const totalClockOuts = perStaff.reduce((s, r) => s + r.clockOutCount, 0);
    const avgMinutes     = perStaff.length
      ? Math.round(perStaff.reduce((s, r) => s + r.totalMinutesWorked, 0) / perStaff.filter(r => r.totalMinutesWorked > 0).length || 0)
      : 0;

    res.json({
      success: true,
      data: { totalClockIns, totalClockOuts, avgMinutes, perStaff, date: start },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/attendance/anomalies ────────────────────────────────────────────
router.get('/anomalies', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const filter = { flagged: true };
    if (req.query.date) {
      const { start, end } = dayRange(req.query.date);
      filter.date = { $gte: start, $lte: end };
    }
    const flagged = await Attendance.find(filter)
      .populate('staff', 'firstName lastName staffId department')
      .sort({ date: -1 }).limit(50);
    res.json({ success: true, data: flagged });
  } catch (err) { next(err); }
});

// ─── GET /api/attendance/staff/:staffId ───────────────────────────────────────
router.get('/staff/:staffId', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { staff: req.params.staffId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(365);
    const present = records.filter(r => ['Present','Half-Day'].includes(r.status)).length;
    res.json({
      success: true, data: records,
      stats: { total: records.length, present, rate: records.length ? Math.round((present / records.length) * 100) : 0 },
    });
  } catch (err) { next(err); }
});

// ─── POST /api/attendance/clockin ─────────────────────────────────────────────
router.post('/clockin', async (req, res, next) => {
  try {
    const { staffId, note } = req.body;
    if (!staffId) return res.status(400).json({ success: false, message: 'staffId is required.' });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"
    const { start, end } = dayRange();

    // Upsert: get-or-create today's record
    let record = await Attendance.findOne({ staff: staffId, date: { $gte: start, $lte: end } });
    if (!record) {
      record = new Attendance({ staff: staffId, date: start, status: 'Present' });
    }

    // Append clock event
    record.clockEvents.push({ type: 'in', time: timeStr, timestamp: now, markedBy: req.user._id, note });
    record.status = record.status || 'Present';
    record.markedBy = req.user._id;
    record.recomputeWorkTime();
    await record.save();

    await audit({
      user: req.user, action: 'CLOCK_IN', module: 'Attendance',
      description: `Clock-in #${record.clockInCount} for ${staff.firstName} ${staff.lastName} at ${timeStr}`,
      resourceId: record._id, resourceType: 'Attendance', ip: req.ip,
    });

    res.json({ success: true, data: record, message: `Clock-in #${record.clockInCount} recorded at ${timeStr}` });
  } catch (err) { next(err); }
});

// ─── POST /api/attendance/clockout ────────────────────────────────────────────
router.post('/clockout', async (req, res, next) => {
  try {
    const { staffId, note } = req.body;
    if (!staffId) return res.status(400).json({ success: false, message: 'staffId is required.' });

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const { start, end } = dayRange();

    let record = await Attendance.findOne({ staff: staffId, date: { $gte: start, $lte: end } });
    if (!record) return res.status(404).json({ success: false, message: 'No attendance record found for today. Clock in first.' });

    // Guard: must have an unpaired clock-in
    const events = [...record.clockEvents].sort((a,b) => a.timestamp - b.timestamp);
    const lastEvent = events[events.length - 1];
    if (!lastEvent || lastEvent.type === 'out') {
      return res.status(400).json({ success: false, message: 'No open clock-in to close. Please clock in first.' });
    }

    record.clockEvents.push({ type: 'out', time: timeStr, timestamp: now, markedBy: req.user._id, note });
    record.recomputeWorkTime();
    await record.save();

    const hoursWorked = record.totalMinutesWorked / 60;

    await audit({
      user: req.user, action: 'CLOCK_OUT', module: 'Attendance',
      description: `Clock-out #${record.clockOutCount} for staffId ${staffId} at ${timeStr} (${hoursWorked.toFixed(1)}h total today)`,
      resourceId: record._id, resourceType: 'Attendance', ip: req.ip,
    });

    res.json({
      success: true, data: record,
      hoursWorked, totalMinutesWorked: record.totalMinutesWorked,
      message: `Clock-out #${record.clockOutCount} at ${timeStr} · Total today: ${hoursWorked.toFixed(1)}h`,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/attendance/staff/:staffId/clock-history ────────────────────────
// Full clock event history for one staff member across multiple days
router.get('/staff/:staffId/clock-history', async (req, res, next) => {
  try {
    const { from, to, limit = 30 } = req.query;
    const filter = { staff: req.params.staffId, 'clockEvents.0': { $exists: true } };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(parseInt(limit));
    res.json({ success: true, data: records });
  } catch (err) { next(err); }
});

// ─── POST /api/attendance — bulk mark (with times) ────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    if (!records.length) return res.status(400).json({ success: false, message: 'Empty records array.' });

    const { start } = dayRange(records[0]?.date);
    let saved = 0;

    for (const r of records) {
      if (!r.staff) continue;
      // For bulk mark we only set status + manual times; don't overwrite clockEvents
      await Attendance.findOneAndUpdate(
        { staff: r.staff, date: start },
        {
          $set: {
            status:   r.status || null,
            markedBy: req.user._id,
            note:     r.note,
            // Only set manual checkIn/Out if no clockEvents exist for this field
            ...(r.checkIn  ? { checkIn:  r.checkIn }  : {}),
            ...(r.checkOut ? { checkOut: r.checkOut } : {}),
          },
        },
        { upsert: true }
      );
      saved++;
    }

    await audit({
      user: req.user, action: 'BULK_MARK_ATTENDANCE', module: 'Attendance',
      description: `Bulk attendance for ${saved} staff on ${start.toDateString()}`,
      ip: req.ip,
    });

    res.json({ success: true, message: `${saved} records saved.` });
  } catch (err) { next(err); }
});

module.exports = router;
