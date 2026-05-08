const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName:   { type: String }, // snapshot at time of action
    userRole:   { type: String },
    action:     { type: String, required: true }, // e.g. 'CREATE_STAFF', 'APPROVE_LEAVE'
    module:     {
      type: String,
      enum: ['Auth','Staff','Attendance','Leave','Promotion','Payroll','Reports','AI','System'],
      required: true,
    },
    resourceId:   { type: String }, // ObjectId of affected document
    resourceType: { type: String }, // e.g. 'Staff', 'Leave'
    description:  { type: String, required: true }, // human-readable summary
    details:      { type: mongoose.Schema.Types.Mixed }, // full before/after if needed
    ip:           { type: String },
    status:       { type: String, enum: ['success','failure'], default: 'success' },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
