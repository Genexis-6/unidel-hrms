const express = require('express');
const Leave   = require('../models/Leave');
const Staff   = require('../models/Staff');
const Notification = require('../models/Notification');
const { checkLeaveEligibility } = require('../utils/aiEngine');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../utils/auditHelper');
const { sendEmail, templates } = require('../utils/emailService');

const router = express.Router();
router.use(protect);

// GET /api/leave
router.get('/', async (req, res, next) => {
  try {
    const { status, staffId, leaveType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)    filter.status    = status;
    if (staffId)   filter.staff     = staffId;
    if (leaveType) filter.leaveType = leaveType;
    if (req.user.role === 'hod') {
      const deptStaff = await Staff.find({ department: req.user.department, isActive: true }, '_id');
      filter.staff = { $in: deptStaff.map(s => s._id) };
    }
    const total   = await Leave.countDocuments(filter);
    const records = await Leave.find(filter)
      .populate('staff', 'firstName lastName staffId department category email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: records, total, page: parseInt(page), pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

// POST /api/leave
router.post('/', async (req, res, next) => {
  try {
    const { staffId, leaveType, startDate, endDate, daysRequested, reason, reliefOfficer } = req.body;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    const { eligible, score, reasons } = await checkLeaveEligibility(staff, { leaveType, daysRequested, startDate, endDate });
    const leave = await Leave.create({
      staff: staffId, leaveType, startDate, endDate, daysRequested, reason, reliefOfficer,
      aiEligible: eligible, aiScore: score, aiReasons: reasons, aiCheckedAt: new Date(),
    });
    await audit({ user: req.user, action: 'SUBMIT_LEAVE', module: 'Leave', description: `Leave request submitted for ${staff.firstName} ${staff.lastName} (${leaveType}, ${daysRequested} days)`, resourceId: leave._id, resourceType: 'Leave', ip: req.ip });
    res.status(201).json({ success: true, data: leave, aiResult: { eligible, score, reasons } });
  } catch (err) { next(err); }
});

// PUT /api/leave/:id/approve
router.put('/:id/approve', authorize('superadmin','registrar','hod'), async (req, res, next) => {
  try {
    const { action, comment } = req.body;
    const leave = await Leave.findById(req.params.id).populate('staff');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found.' });

    if (req.user.role === 'hod') {
      leave.hodApproval   = action === 'approve' ? 'Approved' : 'Rejected';
      leave.hodComment    = comment;
      leave.hodApprovedBy = req.user._id;
      leave.hodApprovedAt = new Date();
    } else {
      leave.registrarApproval   = action === 'approve' ? 'Approved' : 'Rejected';
      leave.registrarComment    = comment;
      leave.registrarApprovedBy = req.user._id;
      leave.registrarApprovedAt = new Date();
      leave.status = action === 'approve' ? 'Approved' : 'Rejected';

      if (action === 'approve' && leave.staff) {
        const balKey = leave.leaveType.toLowerCase();
        const inc = {}; inc[`leaveBalance.${balKey}`] = -leave.daysRequested;
        await Staff.findByIdAndUpdate(leave.staff._id, { $inc: inc });
      }

      // Send email notification to staff
      const staffDoc = leave.staff;
      if (staffDoc?.email) {
        const tmpl = action === 'approve'
          ? templates.leaveApproved(staffDoc, leave)
          : templates.leaveRejected(staffDoc, leave);
        sendEmail({ to: staffDoc.email, ...tmpl }).catch(() => {});
      }

      // Create in-app notification
      await Notification.create({
        recipientRole: null,
        title: action === 'approve' ? '✅ Leave Approved' : '❌ Leave Rejected',
        message: `Your ${leave.leaveType} leave request (${leave.daysRequested} days) has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
        type: 'leave',
        link: '/leave',
      });
    }

    await leave.save();
    await audit({
      user: req.user,
      action: action === 'approve' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      module: 'Leave',
      description: `${req.user.name} ${action === 'approve' ? 'approved' : 'rejected'} leave for ${leave.staff?.firstName} ${leave.staff?.lastName}`,
      resourceId: leave._id, resourceType: 'Leave', ip: req.ip,
    });

    res.json({ success: true, data: leave });
  } catch (err) { next(err); }
});

// GET /api/leave/:id
router.get('/:id', async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('staff').populate('hodApprovedBy','name').populate('registrarApprovedBy','name');
    if (!leave) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: leave });
  } catch (err) { next(err); }
});

module.exports = router;
