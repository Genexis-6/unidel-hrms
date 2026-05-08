const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Annual','Sick','Maternity','Paternity','Study','Emergency','Unpaid'],
      required: true,
    },
    startDate:    { type: Date, required: true },
    endDate:      { type: Date, required: true },
    daysRequested: { type: Number, required: true },
    reason:       { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending','Approved','Rejected','Cancelled'],
      default: 'Pending',
    },

    // AI eligibility check
    aiEligible:     { type: Boolean, default: null },
    aiScore:        { type: Number },
    aiReasons:      [{ type: String }],
    aiCheckedAt:    { type: Date },

    // Approval workflow
    hodApproval:    { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending' },
    hodComment:     { type: String },
    hodApprovedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hodApprovedAt:  { type: Date },

    registrarApproval:   { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending' },
    registrarComment:    { type: String },
    registrarApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registrarApprovedAt: { type: Date },

    reliefOfficer:  { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    attachmentUrl:  { type: String }, // for sick leave docs
  },
  { timestamps: true }
);

LeaveSchema.index({ staff: 1, status: 1 });
LeaveSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', LeaveSchema);
