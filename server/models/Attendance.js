const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Present','Absent','Half-Day','On-Leave','Public-Holiday','Weekend'],
      required: true,
    },
    checkIn:  { type: String }, // "HH:MM"
    checkOut: { type: String },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // AI anomaly flag
    flagged: { type: Boolean, default: false },
    flagReason: { type: String },
    note: { type: String },
  },
  { timestamps: true }
);

// One record per staff per day
AttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
