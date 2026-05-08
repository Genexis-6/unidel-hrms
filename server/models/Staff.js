const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      unique: true,
      // e.g. UNIDEL/CS/2024/001
    },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    middleName:{ type: String, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:     { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender:    { type: String, enum: ['Male','Female','Other'] },

    // Employment
    dateOfEmployment: { type: Date, required: true },
    department: {
      type: String,
      required: true,
      enum: [
        'Computer Science','Engineering','Medicine','Law','Education',
        'Sciences','Arts','Agriculture','Registry','Bursary',
        'Library','Maintenance','Security','ICT','Medical Centre',
      ],
    },
    category: {
      type: String,
      required: true,
      enum: ['Academic','Administrative','Technical'],
    },
    gradeLevel: {
      type: String,
      required: true,
      enum: ['GL 03','GL 04','GL 05','GL 06','GL 07','GL 08','GL 09',
             'GL 10','GL 11','GL 12','GL 13','GL 14','GL 15','GL 16','GL 17'],
    },
    step: { type: Number, default: 1, min: 1, max: 15 },
    designation: { type: String, trim: true },  // e.g. "Senior Lecturer", "Registrar"
    rank: {
      type: String,
      enum: [
        'Graduate Assistant','Assistant Lecturer','Lecturer II','Lecturer I',
        'Senior Lecturer','Reader','Professor',
        'Officer II','Officer I','Senior Officer','Principal Officer',
        'Assistant Registrar','Deputy Registrar','Registrar',
        'Technologist II','Technologist I','Senior Technologist',
      ],
    },

    // Qualifications
    qualifications: [
      {
        degree:      { type: String },  // e.g. "Ph.D"
        field:       { type: String },
        institution: { type: String },
        year:        { type: Number },
      },
    ],
    highestQualification: {
      type: String,
      enum: ['WAEC/NECO','OND','HND','B.Sc/B.A','PGD','M.Sc/M.A','Ph.D','Professor'],
    },
    publications: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ['Active','On Leave','Suspended','Retired','Deceased','Terminated'],
      default: 'Active',
    },
    confirmationDate: { type: Date },
    retirementDate:   { type: Date },

    // Bank & Payroll
    bankName:       { type: String },
    accountNumber:  { type: String },
    bvn:            { type: String },
    pfaName:        { type: String },  // Pension Fund Administrator
    pfaNumber:      { type: String },

    // NIN / IPPIS
    nin:    { type: String },
    ippis:  { type: String },

    // Leave balance (days remaining per type)
    leaveBalance: {
      annual:    { type: Number, default: 28 },
      sick:      { type: Number, default: 14 },
      maternity: { type: Number, default: 90 },
      paternity: { type: Number, default: 14 },
      study:     { type: Number, default: 21 },
    },

    // AI-computed
    aiScore:        { type: Number, default: null },
    lastAiVetDate:  { type: Date },
    aiFlags:        [{ type: String }],

    photo: { type: String }, // URL / base64 or GridFS ref
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate staffId before saving
StaffSchema.pre('save', async function (next) {
  if (!this.staffId) {
    const year   = new Date().getFullYear();
    const deptCode = this.department.replace(/\s+/g,'').substring(0,3).toUpperCase();
    const count  = await mongoose.model('Staff').countDocuments();
    this.staffId = `UNIDEL/${deptCode}/${year}/${String(count + 1).padStart(3,'0')}`;
  }
  next();
});

// Virtual: full name
StaffSchema.virtual('fullName').get(function () {
  return `${this.firstName}${this.middleName ? ' ' + this.middleName : ''} ${this.lastName}`;
});

// Virtual: years of service
StaffSchema.virtual('yearsOfService').get(function () {
  if (!this.dateOfEmployment) return 0;
  return Math.floor((Date.now() - this.dateOfEmployment.getTime()) / (365.25 * 24 * 3600 * 1000));
});

StaffSchema.set('toJSON', { virtuals: true });

// Indexes for common queries
StaffSchema.index({ department: 1, status: 1 });
StaffSchema.index({ category: 1 });
StaffSchema.index({ gradeLevel: 1 });
StaffSchema.index({ '$**': 'text' });  // full-text search

module.exports = mongoose.model('Staff', StaffSchema);
