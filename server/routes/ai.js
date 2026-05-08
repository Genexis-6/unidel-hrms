const express = require('express');
const Staff   = require('../models/Staff');
const { vetPromotion, checkLeaveEligibility, runBatchPayrollAudit } = require('../utils/aiEngine');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// POST /api/ai/vet-promotion — standalone vetting without creating a record
router.post('/vet-promotion', async (req, res, next) => {
  try {
    const { staffId, fromRank, toRank, publications, teachingEvalScore, committeeRoles } = req.body;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const result = await vetPromotion(staff, { fromRank, toRank, publications, teachingEvalScore, committeeRoles });
    // Store on staff record
    await Staff.findByIdAndUpdate(staffId, { aiScore: result.aiScore, lastAiVetDate: new Date() });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/ai/check-leave
router.post('/check-leave', async (req, res, next) => {
  try {
    const { staffId, leaveType, daysRequested, startDate, endDate } = req.body;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const result = await checkLeaveEligibility(staff, { leaveType, daysRequested, startDate, endDate });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/ai/payroll-audit
router.post('/payroll-audit', authorize('superadmin','bursary'), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const result = await runBatchPayrollAudit(parseInt(month), parseInt(year));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
