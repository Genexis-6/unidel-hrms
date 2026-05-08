const nodemailer = require('nodemailer');
const logger = require('./logger');

// ─── Transporter ──────────────────────────────────────────────────────────────
const createTransporter = () => {
  // Use environment SMTP config; falls back to Ethereal (test) if not set
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Dev: log-only mode (no actual send)
  return null;
};

// ─── Base HTML Template ────────────────────────────────────────────────────────
const baseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#F4F2EE; font-family:'Helvetica Neue',Arial,sans-serif; }
  .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
  .header  { background:linear-gradient(135deg,#2C5F2E,#1A3A6B); padding:28px 32px; }
  .header h1 { margin:0; color:#fff; font-size:20px; font-weight:700; }
  .header p  { margin:4px 0 0; color:rgba(255,255,255,.65); font-size:13px; }
  .body    { padding:28px 32px; }
  .body p  { color:#444; font-size:14px; line-height:1.6; margin:0 0 14px; }
  .badge   { display:inline-block; padding:6px 14px; border-radius:6px; font-size:13px; font-weight:600; margin-bottom:16px; }
  .badge-success  { background:#EBF4EB; color:#2C5F2E; }
  .badge-warning  { background:#FFF4E0; color:#7A4A00; }
  .badge-danger   { background:#FDEAEA; color:#8B1A1A; }
  .info-box { background:#F8F7F4; border:1px solid #E2DED6; border-radius:8px; padding:14px 18px; margin-bottom:16px; }
  .info-box table { width:100%; border-collapse:collapse; font-size:13px; }
  .info-box td    { padding:5px 0; color:#444; }
  .info-box td:first-child { color:#888; width:45%; }
  .btn     { display:inline-block; padding:11px 24px; background:#2C5F2E; color:#fff !important; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin-top:8px; }
  .footer  { background:#F4F2EE; padding:16px 32px; text-align:center; font-size:11px; color:#999; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>UNIDEL StaffOS</h1>
    <p>University of Delta, Agbor — Human Resource Management System</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    This is an automated message from UNIDEL StaffOS. Do not reply to this email.<br/>
    © ${new Date().getFullYear()} University of Delta, Agbor
  </div>
</div>
</body>
</html>`;

// ─── Email Templates ───────────────────────────────────────────────────────────

const templates = {

  leaveApproved: (staff, leave) => ({
    subject: `✅ Leave Request Approved — ${leave.leaveType} Leave`,
    html: baseTemplate('Leave Approved', `
      <p>Dear <strong>${staff.firstName} ${staff.lastName}</strong>,</p>
      <span class="badge badge-success">✓ Leave Approved</span>
      <p>Your leave request has been reviewed and <strong>approved</strong> by the Registrar's office.</p>
      <div class="info-box">
        <table>
          <tr><td>Leave Type</td><td><strong>${leave.leaveType}</strong></td></tr>
          <tr><td>Start Date</td><td><strong>${new Date(leave.startDate).toDateString()}</strong></td></tr>
          <tr><td>End Date</td><td><strong>${new Date(leave.endDate).toDateString()}</strong></td></tr>
          <tr><td>Duration</td><td><strong>${leave.daysRequested} day(s)</strong></td></tr>
          <tr><td>AI Eligibility Score</td><td><strong>${leave.aiScore || 'N/A'}/100</strong></td></tr>
          <tr><td>Approver Comment</td><td>${leave.registrarComment || '—'}</td></tr>
        </table>
      </div>
      <p>Please ensure you hand over your duties to your relief officer before proceeding on leave. Contact the Registry if you have any questions.</p>
    `),
  }),

  leaveRejected: (staff, leave) => ({
    subject: `❌ Leave Request Rejected — ${leave.leaveType} Leave`,
    html: baseTemplate('Leave Rejected', `
      <p>Dear <strong>${staff.firstName} ${staff.lastName}</strong>,</p>
      <span class="badge badge-danger">✗ Leave Rejected</span>
      <p>We regret to inform you that your leave request has been <strong>rejected</strong>.</p>
      <div class="info-box">
        <table>
          <tr><td>Leave Type</td><td><strong>${leave.leaveType}</strong></td></tr>
          <tr><td>Requested Dates</td><td><strong>${new Date(leave.startDate).toDateString()} – ${new Date(leave.endDate).toDateString()}</strong></td></tr>
          <tr><td>Duration</td><td><strong>${leave.daysRequested} day(s)</strong></td></tr>
          <tr><td>Reason for Rejection</td><td>${leave.registrarComment || 'Not specified'}</td></tr>
          <tr><td>AI Eligibility Score</td><td><strong>${leave.aiScore || 'N/A'}/100</strong></td></tr>
        </table>
      </div>
      <p>If you believe this decision is incorrect, please visit the Registry office for further clarification.</p>
    `),
  }),

  promotionApproved: (staff, promotion) => ({
    subject: `🎉 Congratulations! Promotion Approved — ${promotion.toRank || promotion.toGradeLevel}`,
    html: baseTemplate('Promotion Approved', `
      <p>Dear <strong>${staff.firstName} ${staff.lastName}</strong>,</p>
      <span class="badge badge-success">🎉 Promotion Approved</span>
      <p>We are pleased to inform you that your promotion application has been <strong>approved</strong>. Congratulations on this well-deserved achievement!</p>
      <div class="info-box">
        <table>
          <tr><td>Staff ID</td><td><strong>${staff.staffId}</strong></td></tr>
          <tr><td>Department</td><td><strong>${staff.department}</strong></td></tr>
          <tr><td>Previous Rank</td><td>${promotion.fromRank || promotion.fromGradeLevel}</td></tr>
          <tr><td>New Rank</td><td><strong>${promotion.toRank || promotion.toGradeLevel}</strong></td></tr>
          <tr><td>New Grade Level</td><td><strong>${promotion.toGradeLevel}</strong></td></tr>
          <tr><td>AI Vetting Score</td><td><strong>${promotion.aiScore}/100</strong></td></tr>
          <tr><td>Effective Date</td><td><strong>${promotion.effectiveDate ? new Date(promotion.effectiveDate).toDateString() : 'As communicated by Registry'}</strong></td></tr>
        </table>
      </div>
      <p>Your updated appointment letter will be issued by the Registry. Please visit the Registry office to complete the necessary documentation.</p>
      <a href="#" class="btn">View Promotion Details</a>
    `),
  }),

  promotionRejected: (staff, promotion) => ({
    subject: `Promotion Application Update — ${promotion.fromRank || promotion.fromGradeLevel}`,
    html: baseTemplate('Promotion Application Update', `
      <p>Dear <strong>${staff.firstName} ${staff.lastName}</strong>,</p>
      <span class="badge badge-warning">Application Not Successful</span>
      <p>After careful review by the Promotions Committee, your promotion application was <strong>not approved</strong> at this time.</p>
      <div class="info-box">
        <table>
          <tr><td>Current Grade Level</td><td><strong>${promotion.fromGradeLevel}</strong></td></tr>
          <tr><td>Applied For</td><td><strong>${promotion.toGradeLevel} (${promotion.toRank || ''})</strong></td></tr>
          <tr><td>AI Vetting Score</td><td><strong>${promotion.aiScore}/100</strong></td></tr>
          <tr><td>Committee Note</td><td>${promotion.rejectionNote || 'Please see Registry for details'}</td></tr>
        </table>
      </div>
      <p>We encourage you to work on the areas highlighted in your AI vetting report. You may re-apply in the next promotion cycle. Visit the Registry for a detailed breakdown of your assessment.</p>
    `),
  }),

  clockInConfirm: (staff, checkIn, date) => ({
    subject: `Clock-In Recorded — ${date}`,
    html: baseTemplate('Clock-In Confirmed', `
      <p>Dear <strong>${staff.firstName} ${staff.lastName}</strong>,</p>
      <span class="badge badge-success">✓ Clock-In Recorded</span>
      <div class="info-box">
        <table>
          <tr><td>Date</td><td><strong>${date}</strong></td></tr>
          <tr><td>Clock-In Time</td><td><strong>${checkIn}</strong></td></tr>
          <tr><td>Staff ID</td><td>${staff.staffId}</td></tr>
        </table>
      </div>
      <p>Your attendance has been recorded. Have a productive day!</p>
    `),
  }),
};

// ─── Send Email Function ───────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();

  if (!transporter) {
    // Dev mode — just log
    logger.info(`[EMAIL] (dev no-send) To: ${to} | Subject: ${subject}`);
    return { success: true, dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"UNIDEL StaffOS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`[EMAIL] Failed to send to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail, templates };
