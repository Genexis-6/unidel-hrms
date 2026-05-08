const cron   = require('node-cron');
const logger = require('./logger');
const { runBatchPayrollAudit } = require('./aiEngine');

const init = () => {
  // Daily at 23:55 — auto-mark remaining attendance as Absent
  cron.schedule('55 23 * * 1-5', async () => {
    logger.info('[CRON] Running end-of-day attendance auto-close...');
    try {
      const Attendance = require('../models/Attendance');
      const Staff      = require('../models/Staff');
      const today = new Date();
      today.setHours(0,0,0,0);

      const allStaff = await Staff.find({ status: 'Active', isActive: true }, '_id');
      const marked   = await Attendance.distinct('staff', { date: today });
      const unmarked = allStaff.filter(s => !marked.map(String).includes(String(s._id)));

      const bulkOps = unmarked.map(s => ({
        insertOne: {
          document: {
            staff: s._id,
            date: today,
            status: 'Absent',
            flagged: true,
            flagReason: 'Auto-marked absent — no attendance record found.',
          },
        },
      }));

      if (bulkOps.length) {
        await Attendance.bulkWrite(bulkOps, { ordered: false });
        logger.info(`[CRON] Auto-marked ${bulkOps.length} staff absent.`);
      }
    } catch (err) {
      logger.error(`[CRON] Attendance auto-close error: ${err.message}`);
    }
  });

  // 1st of each month at 07:00 — run payroll anomaly detection
  cron.schedule('0 7 1 * *', async () => {
    logger.info('[CRON] Running monthly payroll anomaly scan...');
    try {
      const now = new Date();
      await runBatchPayrollAudit(now.getMonth() + 1, now.getFullYear());
    } catch (err) {
      logger.error(`[CRON] Payroll audit cron error: ${err.message}`);
    }
  });

  // Every Monday at 08:00 — re-score promotion queue
  cron.schedule('0 8 * * 1', async () => {
    logger.info('[CRON] Re-scoring pending promotion applications...');
    try {
      const Promotion = require('../models/Promotion');
      const Staff     = require('../models/Staff');
      const { vetPromotion } = require('./aiEngine');

      const pending = await Promotion.find({ status: 'Pending' }).populate('staff');
      for (const promo of pending) {
        if (!promo.staff) continue;
        const result = await vetPromotion(promo.staff, {
          fromRank: promo.fromRank,
          toRank:   promo.toRank,
          publications: promo.publications,
          teachingEvalScore: promo.teachingEvalScore,
          committeeRoles: promo.committeeRoles,
        });
        await Promotion.findByIdAndUpdate(promo._id, {
          ...result,
          status: result.aiDecision === 'Approved' ? 'AI-Approved' : 'Pending',
        });
      }
      logger.info(`[CRON] Re-scored ${pending.length} promotions.`);
    } catch (err) {
      logger.error(`[CRON] Promotion re-score error: ${err.message}`);
    }
  });

  logger.info('[CRON] Scheduled jobs initialized.');
};

module.exports = { init };
