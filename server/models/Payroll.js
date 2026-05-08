const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    month:  { type: Number, required: true, min: 1, max: 12 }, // 1–12
    year:   { type: Number, required: true },
    cycle:  { type: String }, // e.g. "MAY-2026"

    // Earnings
    basicSalary:         { type: Number, required: true },
    housingAllowance:    { type: Number, default: 0 },
    transportAllowance:  { type: Number, default: 0 },
    medicalAllowance:    { type: Number, default: 0 },
    researchAllowance:   { type: Number, default: 0 },
    otherAllowances:     { type: Number, default: 0 },
    grossSalary:         { type: Number },

    // Deductions
    tax:           { type: Number, default: 0 },  // PAYE
    pension:       { type: Number, default: 0 },  // 8% of basic
    nhf:           { type: Number, default: 0 },  // National Housing Fund
    cooperative:   { type: Number, default: 0 },
    loan:          { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number },
    netSalary:     { type: Number },

    // Status
    status: {
      type: String,
      enum: ['Draft','Processed','Paid','Suspended','Flagged'],
      default: 'Draft',
    },
    paymentDate:   { type: Date },
    paymentMethod: { type: String, enum: ['Bank Transfer','Cash','Cheque'], default: 'Bank Transfer' },

    // AI anomaly detection
    flagged:       { type: Boolean, default: false },
    flagReason:    { type: String },
    flaggedAt:     { type: Date },
    flagResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note:        { type: String },
  },
  { timestamps: true }
);

// One payroll record per staff per month
PayrollSchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });
PayrollSchema.index({ year: 1, month: 1, status: 1 });

// Auto-compute derived fields
PayrollSchema.pre('save', function (next) {
  this.grossSalary = (this.basicSalary || 0)
    + (this.housingAllowance || 0)
    + (this.transportAllowance || 0)
    + (this.medicalAllowance || 0)
    + (this.researchAllowance || 0)
    + (this.otherAllowances || 0);

  this.totalDeductions = (this.tax || 0)
    + (this.pension || 0)
    + (this.nhf || 0)
    + (this.cooperative || 0)
    + (this.loan || 0)
    + (this.otherDeductions || 0);

  this.netSalary = this.grossSalary - this.totalDeductions;
  next();
});

module.exports = mongoose.model('Payroll', PayrollSchema);
