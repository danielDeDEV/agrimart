const { AuditLog } = require('../models');
const { activity } = require('../sockets/io');
const logger = require('../utils/logger');

/**
 * Records an administrative action. Never throws — an audit failure must not
 * roll back the business operation it was describing.
 */
async function record(req, { action, entity, entityId, description, oldValue, newValue, severity = 'info' }) {
  try {
    const user = req?.user;
    const log = await AuditLog.create({
      userId: user?.id || null,
      actorName: user?.fullName || 'System',
      actorRole: user?.role || 'system',
      action,
      entity,
      entityId,
      description,
      oldValue: oldValue || null,
      newValue: newValue || null,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: String(req?.headers?.['user-agent'] || '').substring(0, 250),
      severity,
    });

    activity(action, description || action, { entity, entityId, actor: log.actorName });
    return log;
  } catch (err) {
    logger.warn('Audit log failed:', err.message);
    return null;
  }
}

/** Diff helper so audit entries only carry fields that actually changed. */
function diff(before = {}, after = {}, fields = []) {
  const keys = fields.length ? fields : Object.keys(after);
  const oldValue = {};
  const newValue = {};
  keys.forEach((k) => {
    if (String(before[k]) !== String(after[k])) {
      oldValue[k] = before[k];
      newValue[k] = after[k];
    }
  });
  return { oldValue, newValue, changed: Object.keys(newValue).length > 0 };
}

module.exports = { record, diff };
