const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Create an audit log entry
 * @param {Object} params
 * @param {Object} params.user - req.user object
 * @param {string} params.action - e.g. 'APPROVE_LEAVE'
 * @param {string} params.module - e.g. 'Leave'
 * @param {string} params.description - human readable
 * @param {string} [params.resourceId] - affected doc ID
 * @param {string} [params.resourceType] - e.g. 'Leave'
 * @param {Object} [params.details] - extra data
 * @param {string} [params.ip] - request IP
 * @param {string} [params.status] - 'success' | 'failure'
 * @param {string} [params.errorMessage]
 */
const audit = async ({ user, action, module, description, resourceId, resourceType, details, ip, status = 'success', errorMessage }) => {
  try {
    await AuditLog.create({
      user:         user?._id || user,
      userName:     user?.name,
      userRole:     user?.role,
      action,
      module,
      description,
      resourceId:   resourceId?.toString(),
      resourceType,
      details,
      ip,
      status,
      errorMessage,
    });
  } catch (err) {
    logger.error(`[AUDIT] Failed to write audit log: ${err.message}`);
  }
};

module.exports = { audit };
