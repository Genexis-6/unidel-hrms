const express   = require('express');
const Promotion = require('../models/Promotion');
const Staff     = require('../models/Staff');
const Notification = require('../models/Notification');
const { vetPromotion } = require('../utils/aiEngine');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../utils/auditHelper');
const { sendEmail, templates } = require('../utils/emailService');

const router = express.Router();
router.use(protect);

// GET /api/promotion
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, cycle } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (cycle) filter.cycle = cycle;
    const total = await Promotion.countDocuments(filter);
    const data  = await Promotion.find(filter)
      .populate('staff', 'firstName lastName staffId department category gradeLevel email')
      .sort({ aiScore: -1, createdAt: -1 })
      .skip((page-1)*limit).limit(parseInt(limit));
    res.json({ success: true, data, total, pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

// POST /api/promotion
router.post('/', async (req, res, next) => {
  try {
    const { staffId, fromGradeLevel, toGradeLevel, fromRank, toRank, publications, teachingEvalScore, committeeRoles, cycle } = req.body;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const aiResult = await vetPromotion(staff, { fromRank, toRank, publications, teachingEvalScore, committeeRoles });
    const promo = await Promotion.create({
      staff: staffId, fromGradeLevel, toGradeLevel, fromRank, toRank,
      publications, teachingEvalScore, committeeRoles, cycle,
      ...aiResult,
      status: aiResult.aiDecision === 'Approved' ? 'AI-Approved' : 'Pending',
    });
    await audit({ user: req.user, action: 'SUBMIT_PROMOTION', module: 'Promotion', description: `Promotion application submitted for ${staff.firstName} ${staff.lastName} (AI Score: ${aiResult.aiScore})`, resourceId: promo._id, resourceType: 'Promotion', ip: req.ip });
    res.status(201).json({ success: true, data: promo, aiResult });
  } catch (err) { next(err); }
});

// POST /api/promotion/:id/revet
router.post('/:id/revet', async (req, res, next) => {
  try {
    const promo = await Promotion.findById(req.params.id).populate('staff');
    if (!promo) return res.status(404).json({ success: false, message: 'Not found.' });
    const aiResult = await vetPromotion(promo.staff, { fromRank: promo.fromRank, toRank: promo.toRank, publications: promo.publications, teachingEvalScore: promo.teachingEvalScore, committeeRoles: promo.committeeRoles });
    await Promotion.findByIdAndUpdate(req.params.id, { ...aiResult, status: aiResult.aiDecision === 'Approved' ? 'AI-Approved' : 'Pending' });
    await audit({ user: req.user, action: 'REVET_PROMOTION', module: 'Promotion', description: `Re-vetted promotion for ${promo.staff?.firstName} ${promo.staff?.lastName} — new score: ${aiResult.aiScore}`, resourceId: promo._id, resourceType: 'Promotion', ip: req.ip });
    res.json({ success: true, aiResult });
  } catch (err) { next(err); }
});

// PUT /api/promotion/:id/finalize
router.put('/:id/finalize', authorize('superadmin','registrar'), async (req, res, next) => {
  try {
    const { decision, rejectionNote, effectiveDate } = req.body;
    const promo = await Promotion.findById(req.params.id).populate('staff');
    if (!promo) return res.status(404).json({ success: false, message: 'Not found.' });

    const update = {
      status:       decision === 'approve' ? 'Approved' : 'Rejected',
      approvedBy:   req.user._id,
      approvedAt:   new Date(),
      rejectionNote,
      effectiveDate,
    };

    if (decision === 'approve') {
      await Staff.findByIdAndUpdate(promo.staff._id, { gradeLevel: promo.toGradeLevel, rank: promo.toRank });
    }

    const updated = await Promotion.findByIdAndUpdate(req.params.id, update, { new: true }).populate('staff');

    // Send email
    const staffDoc = promo.staff;
    if (staffDoc?.email) {
      const tmpl = decision === 'approve'
        ? templates.promotionApproved(staffDoc, { ...promo.toObject(), effectiveDate, toRank: promo.toRank, toGradeLevel: promo.toGradeLevel })
        : templates.promotionRejected(staffDoc, { ...promo.toObject(), rejectionNote });
      sendEmail({ to: staffDoc.email, ...tmpl }).catch(() => {});
    }

    // In-app notification
    await Notification.create({
      title: decision === 'approve' ? '🎉 Promotion Approved' : 'Promotion Application Update',
      message: decision === 'approve'
        ? `Congratulations! Your promotion to ${promo.toRank || promo.toGradeLevel} has been approved.`
        : `Your promotion application has not been approved at this time.`,
      type: 'promotion',
      link: '/promotion',
    });

    await audit({
      user: req.user,
      action: decision === 'approve' ? 'APPROVE_PROMOTION' : 'REJECT_PROMOTION',
      module: 'Promotion',
      description: `${req.user.name} ${decision === 'approve' ? 'approved' : 'rejected'} promotion for ${staffDoc?.firstName} ${staffDoc?.lastName}`,
      resourceId: promo._id, resourceType: 'Promotion', ip: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// GET /api/promotion/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Promotion.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, avgScore: { $avg: '$aiScore' } } }]);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

module.exports = router;
