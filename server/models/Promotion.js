const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    fromGradeLevel: { type: String, required: true },
    toGradeLevel:   { type: String, required: true },
    fromRank:       { type: String },
    toRank:         { type: String },
    applicationDate: { type: Date, default: Date.now },
    effectiveDate:   { type: Date },

    // Supporting documents
    publications:       { type: Number, default: 0 },
    teachingEvalScore:  { type: Number, min: 0, max: 100 },
    committeeRoles:     { type: Number, default: 0 },
    yearsSinceLastPromo: { type: Number },

    // AI vetting
    aiScore:          { type: Number, min: 0, max: 100 },
    aiDecision:       { type: String, enum: ['Approved','Review','Rejected','Pending'], default: 'Pending' },
    aiBreakdown: {
      yearsOfService:      { type: Number },
      publications:        { type: Number },
      teachingEvaluation:  { type: Number },
      attendanceRecord:    { type: Number },
      pscCompliance:       { type: Number },
      committeeWork:       { type: Number },
    },
    aiReasons:   [{ type: String }],
    aiVettedAt:  { type: Date },

    // Human approval
    status: {
      type: String,
      enum: ['Pending','AI-Approved','Under-Review','Approved','Rejected'],
      default: 'Pending',
    },
    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    { type: Date },
    rejectionNote: { type: String },
    cycle:         { type: String }, // e.g. "2024/2025"
  },
  { timestamps: true }
);

PromotionSchema.index({ staff: 1, status: 1 });
PromotionSchema.index({ aiScore: -1 });

module.exports = mongoose.model('Promotion', PromotionSchema);
