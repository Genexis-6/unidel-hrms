/**
 * UNIDEL AI Vetting Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule-based + weighted-scoring AI engine for:
 *   1. Promotion eligibility vetting
 *   2. Leave eligibility check
 *   3. Payroll anomaly detection
 *
 * Designed to align with Nigerian Public Service Rules (PSR) and
 * Federal University promotion guidelines.
 */

const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Payroll    = require('../models/Payroll');
const logger     = require('./logger');

// ─── Promotion Vetting ────────────────────────────────────────────────────────

/**
 * Weights for each criterion (must sum to 1.0)
 */
const PROMOTION_WEIGHTS = {
  yearsOfService:     0.25,
  publications:       0.25,
  teachingEvaluation: 0.20,
  attendanceRecord:   0.15,
  pscCompliance:      0.10,
  committeeWork:      0.05,
};

/**
 * Minimum years required for promotion by rank transition.
 * Based on Federal University Staff Conditions of Service.
 */
const MIN_YEARS_BY_RANK = {
  'Graduate Assistant→Assistant Lecturer': 2,
  'Assistant Lecturer→Lecturer II': 3,
  'Lecturer II→Lecturer I': 3,
  'Lecturer I→Senior Lecturer': 3,
  'Senior Lecturer→Reader': 4,
  'Reader→Professor': 5,
  default: 3,
};

/**
 * Minimum publications required for academic promotion.
 */
const MIN_PUBLICATIONS_BY_RANK = {
  'Lecturer II→Lecturer I': 2,
  'Lecturer I→Senior Lecturer': 4,
  'Senior Lecturer→Reader': 6,
  'Reader→Professor': 8,
  default: 1,
};

/**
 * Score a 0–100 value for years of service.
 * Perfect = met or exceeded requirement; 0 = far below.
 */
function scoreYearsOfService(yearsOfService, fromRank, toRank) {
  const key = `${fromRank}→${toRank}`;
  const required = MIN_YEARS_BY_RANK[key] || MIN_YEARS_BY_RANK.default;
  if (yearsOfService >= required * 1.5) return 100;
  if (yearsOfService >= required) return 80;
  if (yearsOfService >= required * 0.75) return 50;
  return Math.max(0, Math.round((yearsOfService / required) * 50));
}

/**
 * Score publications (academic staff only).
 * Non-academic staff receive a flat pass score.
 */
function scorePublications(publications, fromRank, toRank, category) {
  if (category !== 'Academic') return 80; // non-academic — not applicable
  const key = `${fromRank}→${toRank}`;
  const required = MIN_PUBLICATIONS_BY_RANK[key] || MIN_PUBLICATIONS_BY_RANK.default;
  if (publications === 0) return 0;
  if (publications >= required * 2) return 100;
  if (publications >= required) return 80;
  return Math.round((publications / required) * 70);
}

/**
 * Score teaching/performance evaluations (0–100 input → 0–100 output).
 */
function scoreTeachingEvaluation(evalScore) {
  if (evalScore == null) return 60; // default when not provided
  return Math.min(100, Math.round(evalScore));
}

/**
 * Score attendance record from the database.
 * Returns 0–100 based on presence rate over last 12 months.
 */
async function scoreAttendanceRecord(staffId) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const records = await Attendance.find({
      staff: staffId,
      date:  { $gte: oneYearAgo },
      status: { $nin: ['Weekend','Public-Holiday'] },
    });

    if (records.length === 0) return 70; // insufficient data — give benefit of doubt
    const present = records.filter(r => ['Present','Half-Day'].includes(r.status)).length;
    const rate = present / records.length;
    return Math.round(rate * 100);
  } catch {
    return 70;
  }
}

/**
 * PSC Compliance score: checks no active suspensions or disciplinary actions.
 * Simplified heuristic — extend with Disciplinary model if needed.
 */
async function scorePscCompliance(staff) {
  let score = 100;
  if (staff.status === 'Suspended') score -= 50;
  if (staff.aiFlags && staff.aiFlags.length > 0) score -= staff.aiFlags.length * 10;
  return Math.max(0, score);
}

/**
 * Score committee/service work (0–5 roles → score).
 */
function scoreCommitteeWork(committeeRoles) {
  if (committeeRoles >= 5) return 100;
  if (committeeRoles >= 3) return 80;
  if (committeeRoles >= 1) return 60;
  return 30;
}

/**
 * Main promotion vetting function.
 * Returns a detailed AI assessment object.
 */
async function vetPromotion(staff, promotionData) {
  const {
    fromRank,
    toRank,
    publications    = staff.publications || 0,
    teachingEvalScore,
    committeeRoles  = 0,
  } = promotionData;

  const yearsOfService = staff.yearsOfService || 0;

  // Compute individual criterion scores
  const breakdown = {
    yearsOfService:    scoreYearsOfService(yearsOfService, fromRank, toRank),
    publications:      scorePublications(publications, fromRank, toRank, staff.category),
    teachingEvaluation: scoreTeachingEvaluation(teachingEvalScore),
    attendanceRecord:  await scoreAttendanceRecord(staff._id),
    pscCompliance:     await scorePscCompliance(staff),
    committeeWork:     scoreCommitteeWork(committeeRoles),
  };

  // Weighted total
  const totalScore = Math.round(
    Object.entries(PROMOTION_WEIGHTS).reduce((sum, [key, weight]) => {
      return sum + (breakdown[key] || 0) * weight;
    }, 0)
  );

  const passThreshold = parseInt(process.env.AI_PROMOTION_PASS_SCORE || '75');

  // Build reasons
  const reasons = [];
  if (breakdown.yearsOfService < 60) reasons.push('Insufficient years since last promotion.');
  if (breakdown.publications < 50)   reasons.push('Publications below minimum requirement.');
  if (breakdown.attendanceRecord < 70) reasons.push('Attendance record below acceptable threshold.');
  if (breakdown.pscCompliance < 80)  reasons.push('Active PSC compliance issues noted.');
  if (totalScore >= passThreshold)   reasons.push('All primary criteria satisfied — eligible for promotion.');

  const decision =
    totalScore >= passThreshold        ? 'Approved'
    : totalScore >= passThreshold - 15 ? 'Review'
    : 'Rejected';

  logger.info(`AI Promotion Vetting: ${staff.fullName || staff._id} → Score ${totalScore} → ${decision}`);

  return {
    staffId:    staff._id,
    aiScore:    totalScore,
    aiDecision: decision,
    aiBreakdown: breakdown,
    aiReasons:   reasons,
    aiVettedAt:  new Date(),
  };
}

// ─── Leave Eligibility Check ──────────────────────────────────────────────────

/**
 * Check if a staff member is eligible for the requested leave.
 * Returns { eligible, score, reasons }.
 */
async function checkLeaveEligibility(staff, leaveData) {
  const { leaveType, daysRequested, startDate, endDate } = leaveData;
  const reasons = [];
  let score = 100;

  // 1. Balance check
  const balanceKey = leaveType.toLowerCase();
  const balance = (staff.leaveBalance || {})[balanceKey];
  if (balance !== undefined && daysRequested > balance) {
    score -= 40;
    reasons.push(`Insufficient ${leaveType} leave balance (${balance} days remaining, ${daysRequested} requested).`);
  }

  // 2. Overlapping approved leave
  const overlap = await Leave.findOne({
    staff: staff._id,
    status: 'Approved',
    startDate: { $lte: new Date(endDate) },
    endDate:   { $gte: new Date(startDate) },
  });
  if (overlap) {
    score -= 30;
    reasons.push('Overlap with an existing approved leave period detected.');
  }

  // 3. Consecutive leave abuse (>3 sick leave in past 90 days)
  if (leaveType === 'Sick') {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentSick = await Leave.countDocuments({
      staff: staff._id,
      leaveType: 'Sick',
      status: { $in: ['Approved','Pending'] },
      startDate: { $gte: ninetyDaysAgo },
    });
    if (recentSick >= 3) {
      score -= 20;
      reasons.push('Frequent sick leave pattern detected — medical certificate required.');
    }
  }

  // 4. Probation guard (< 1 year service cannot take Annual leave)
  if (leaveType === 'Annual' && staff.yearsOfService < 1) {
    score -= 30;
    reasons.push('Staff is in probationary period — Annual leave not yet earned.');
  }

  const eligible = score >= 60;
  if (eligible) reasons.push('Leave eligibility criteria satisfied.');

  return { eligible, score: Math.max(0, score), reasons };
}

// ─── Payroll Anomaly Detection ────────────────────────────────────────────────

/**
 * Detect anomalies in a single payroll record.
 * Returns { flagged, reason }.
 */
async function detectPayrollAnomaly(payrollDoc, staff) {
  const flags = [];

  // 1. Salary grade mismatch — compare gross against expected range
  const gradeSalaryMap = {
    'GL 07': [80000,  140000],
    'GL 08': [100000, 170000],
    'GL 09': [130000, 210000],
    'GL 10': [160000, 260000],
    'GL 12': [210000, 330000],
    'GL 13': [260000, 380000],
    'GL 14': [300000, 430000],
    'GL 15': [380000, 550000],
  };
  const range = gradeSalaryMap[staff.gradeLevel];
  if (range && (payrollDoc.grossSalary < range[0] || payrollDoc.grossSalary > range[1])) {
    flags.push(`Gross salary ₦${payrollDoc.grossSalary.toLocaleString()} is outside expected range for ${staff.gradeLevel}.`);
  }

  // 2. Duplicate BVN / IPPIS check — find other staff with same account
  if (staff.accountNumber) {
    const dupeCount = await require('../models/Staff').countDocuments({
      accountNumber: staff.accountNumber,
      _id: { $ne: staff._id },
      isActive: true,
    });
    if (dupeCount > 0) {
      flags.push(`Duplicate bank account number detected — potential phantom worker.`);
    }
  }

  // 3. Retired/inactive staff still on payroll
  if (['Retired','Terminated','Deceased'].includes(staff.status)) {
    flags.push(`Staff status is '${staff.status}' but still on active payroll.`);
  }

  // 4. Zero deductions on a high salary (suspicious)
  if (payrollDoc.grossSalary > 200000 && payrollDoc.totalDeductions === 0) {
    flags.push('No deductions applied on salary above ₦200,000 — verify tax and pension records.');
  }

  const flagged = flags.length > 0;
  return { flagged, reason: flags.join(' | ') };
}

/**
 * Run batch payroll anomaly detection for a given month/year.
 */
async function runBatchPayrollAudit(month, year) {
  const Payroll = require('../models/Payroll');
  const Staff   = require('../models/Staff');

  const records = await Payroll.find({ month, year }).populate('staff');
  const results = { total: records.length, flagged: 0, flags: [] };

  for (const record of records) {
    if (!record.staff) continue;
    const { flagged, reason } = await detectPayrollAnomaly(record, record.staff);
    if (flagged) {
      results.flagged++;
      results.flags.push({ staffId: record.staff._id, name: record.staff.fullName, reason });
      await Payroll.findByIdAndUpdate(record._id, {
        flagged: true,
        flagReason: reason,
        flaggedAt: new Date(),
        status: 'Flagged',
      });
    }
  }

  logger.info(`Payroll audit (${month}/${year}): ${results.flagged}/${results.total} records flagged.`);
  return results;
}

module.exports = {
  vetPromotion,
  checkLeaveEligibility,
  detectPayrollAnomaly,
  runBatchPayrollAudit,
};
