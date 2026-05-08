const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // null = broadcast to all
    recipientRole: { type: String }, // or target all users of a role
    title:   { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['leave','promotion','payroll','attendance','system','ai'],
      default: 'system',
    },
    link:    { type: String }, // e.g. '/leave' or '/promotion'
    read:    { type: Boolean, default: false },
    readAt:  { type: Date },
    icon:    { type: String },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
