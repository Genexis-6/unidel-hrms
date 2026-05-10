const mongoose = require('mongoose');

// Each clock-in/clock-out event stored individually
const ClockEventSchema = new mongoose.Schema({
  type:      { type: String, enum: ['in','out'], required: true },
  time:      { type: String, required: true },   // "HH:MM"
  timestamp: { type: Date,   required: true },
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:      { type: String },
}, { _id: true });

const AttendanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Staff',
      required: true,
    },
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ['Present','Absent','Half-Day','On-Leave','Public-Holiday','Weekend'],
      default: null,
    },

    // First clock-in of the day (convenience field)
    checkIn:  { type: String },   // "HH:MM"
    // Last clock-out of the day (convenience field)
    checkOut: { type: String },   // "HH:MM"

    // Full ordered history of every clock event this day
    clockEvents: [ClockEventSchema],

    // Computed totals (updated on every clock event)
    totalMinutesWorked: { type: Number, default: 0 },
    clockInCount:       { type: Number, default: 0 },
    clockOutCount:      { type: Number, default: 0 },

    markedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    flagged:    { type: Boolean, default: false },
    flagReason: { type: String },
    note:       { type: String },
  },
  { timestamps: true }
);

// One record per staff per day
AttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ staff: 1, date: -1 });

/**
 * Recompute totalMinutesWorked from clockEvents array.
 * Pairs each 'in' with the next 'out'.
 */
AttendanceSchema.methods.recomputeWorkTime = function () {
  const events = [...this.clockEvents].sort((a, b) => a.timestamp - b.timestamp);
  let total = 0;
  let openIn = null;
  for (const ev of events) {
    if (ev.type === 'in') {
      openIn = ev.timestamp;
    } else if (ev.type === 'out' && openIn) {
      total += (ev.timestamp - openIn) / 60000; // ms → minutes
      openIn = null;
    }
  }
  this.totalMinutesWorked = Math.round(total);
  this.clockInCount  = events.filter(e => e.type === 'in').length;
  this.clockOutCount = events.filter(e => e.type === 'out').length;
  // First in / last out convenience fields
  const firstIn  = events.find(e => e.type === 'in');
  const lastOut  = [...events].reverse().find(e => e.type === 'out');
  if (firstIn)  this.checkIn  = firstIn.time;
  if (lastOut)  this.checkOut = lastOut.time;
};

module.exports = mongoose.model('Attendance', AttendanceSchema);
