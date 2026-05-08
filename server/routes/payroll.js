const express = require('express');
const Payroll = require('../models/Payroll');
const Staff   = require('../models/Staff');
const { detectPayrollAnomaly, runBatchPayrollAudit } = require('../utils/aiEngine');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Salary structure by grade level (₦ basic salary)
const SALARY_TABLE = {
  'GL 03': 45000,  'GL 04': 58000,  'GL 05': 72000,
  'GL 06': 88000,  'GL 07': 106000, 'GL 08': 128000,
  'GL 09': 155000, 'GL 10': 185000, 'GL 11': 215000,
  'GL 12': 248000, 'GL 13': 285000, 'GL 14': 325000,
  'GL 15': 390000, 'GL 16': 460000, 'GL 17': 540000,
};

const ALLOWANCE_RATES = {
  housing:   0.25,
  transport: 0.15,
  medical:   0.05,
  research:  0.10,  // Academic only
};

// GET /api/payroll?month=5&year=2026
router.get('/', authorize('superadmin','registrar','bursary'), async (req, res, next) => {
  try {
    const { month, year, status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (month)  filter.month  = parseInt(month);
    if (year)   filter.year   = parseInt(year);
    if (status) filter.status = status;

    const total = await Payroll.countDocuments(filter);
    const data  = await Payroll.find(filter)
      .populate('staff', 'firstName lastName staffId department gradeLevel category status bankName accountNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Totals
    const totals = await Payroll.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalGross: { $sum: '$grossSalary' },
        totalNet:   { $sum: '$netSalary' },
        totalTax:   { $sum: '$tax' },
        flagged:    { $sum: { $cond: ['$flagged', 1, 0] } },
      }},
    ]);

    res.json({ success: true, data, total, totals: totals[0] || {}, pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

// POST /api/payroll/generate — auto-generate payroll for a month
router.post('/generate', authorize('superadmin','bursary'), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const allStaff = await Staff.find({ status: 'Active', isActive: true });
    const created = [], skipped = [];

    for (const s of allStaff) {
      const existing = await Payroll.findOne({ staff: s._id, month, year });
      if (existing) { skipped.push(s.staffId); continue; }

      const basic     = SALARY_TABLE[s.gradeLevel] || 100000;
      const housing   = Math.round(basic * ALLOWANCE_RATES.housing);
      const transport = Math.round(basic * ALLOWANCE_RATES.transport);
      const medical   = Math.round(basic * ALLOWANCE_RATES.medical);
      const research  = s.category === 'Academic' ? Math.round(basic * ALLOWANCE_RATES.research) : 0;
      const gross     = basic + housing + transport + medical + research;
      const pension   = Math.round(basic * 0.08);
      const nhf       = Math.round(basic * 0.025);
      const tax       = gross > 300000 ? Math.round((gross - 300000) * 0.24) : 0;

      const payDoc = await Payroll.create({
        staff: s._id,
        month: parseInt(month),
        year:  parseInt(year),
        cycle: `${new Date(year, month-1).toLocaleString('en',{month:'short'}).toUpperCase()}-${year}`,
        basicSalary: basic,
        housingAllowance: housing,
        transportAllowance: transport,
        medicalAllowance: medical,
        researchAllowance: research,
        pension, nhf, tax,
        status: 'Processed',
        processedBy: req.user._id,
      });
      created.push(payDoc._id);
    }

    // Run AI anomaly detection on newly generated records
    const auditResult = await runBatchPayrollAudit(parseInt(month), parseInt(year));

    res.json({
      success: true,
      message: `Payroll generated: ${created.length} new records, ${skipped.length} skipped.`,
      created: created.length,
      skipped: skipped.length,
      anomalies: auditResult.flagged,
    });
  } catch (err) { next(err); }
});

// POST /api/payroll/audit — run AI anomaly detection
router.post('/audit', authorize('superadmin','bursary'), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const result = await runBatchPayrollAudit(parseInt(month), parseInt(year));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/payroll/flags
router.get('/flags', authorize('superadmin','bursary'), async (req, res, next) => {
  try {
    const flags = await Payroll.find({ flagged: true })
      .populate('staff', 'firstName lastName staffId department gradeLevel status')
      .sort({ flaggedAt: -1 });
    res.json({ success: true, data: flags });
  } catch (err) { next(err); }
});

// PUT /api/payroll/:id/resolve-flag
router.put('/:id/resolve-flag', authorize('superadmin','bursary'), async (req, res, next) => {
  try {
    const updated = await Payroll.findByIdAndUpdate(req.params.id, {
      flagged: false,
      flagReason: null,
      status: 'Processed',
      flagResolvedBy: req.user._id,
    }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// GET /api/payroll/slip/:staffId/:month/:year — payslip data
router.get('/slip/:staffId/:month/:year', async (req, res, next) => {
  try {
    const { staffId, month, year } = req.params;
    const staff = await Staff.findById(staffId);
    const slip  = await Payroll.findOne({ staff: staffId, month: parseInt(month), year: parseInt(year) });
    if (!slip) return res.status(404).json({ success: false, message: 'Payslip not found.' });
    res.json({ success: true, data: { ...slip.toObject(), staffInfo: staff } });
  } catch (err) { next(err); }
});

module.exports = router;
