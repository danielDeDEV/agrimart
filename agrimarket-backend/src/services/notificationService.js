const { Notification, User } = require('../models');
const { sendSms } = require('./smsService');
const { emitToUser } = require('../sockets/io');
const logger = require('../utils/logger');

/**
 * Creates an in-app notification, pushes it over the socket so the bell badge
 * updates instantly, and optionally mirrors it to SMS for farmers who are not
 * on the website.
 */
async function notify({
  userId,
  title,
  message,
  type = 'system',
  priority = 'normal',
  icon = 'Bell',
  link = null,
  relatedType = null,
  relatedId = null,
  sms = false,
  smsTemplate = null,
  smsData = {},
  smsType = null,
  force = false,
}) {
  if (!userId) return null;

  const notification = await Notification.create({
    userId, title, message, type, priority, icon, link, relatedType, relatedId,
  });

  emitToUser(userId, 'notification', notification.toJSON());

  if (sms) {
    const user = await User.findByPk(userId);
    if (user?.phone) {
      const res = await sendSms({
        to: user.phone,
        userId,
        message: smsTemplate ? undefined : `AgriMart: ${message}`,
        template: smsTemplate || undefined,
        data: smsData,
        type: smsType || type,
        relatedType,
        relatedId,
        force,
      });
      if (res.success) await notification.update({ sentViaSms: true });
    }
  }

  return notification;
}

/** Fan a single notification out to many users (e.g. all farmers in a region). */
async function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const results = await Promise.allSettled(unique.map((id) => notify({ ...payload, userId: id })));
  const created = results.filter((r) => r.status === 'fulfilled').length;
  logger.info(`Notified ${created}/${unique.length} users: ${payload.title}`);
  return created;
}

const markRead = async (userId, ids) => {
  const where = { userId, isRead: false };
  if (Array.isArray(ids) && ids.length) where.id = ids;
  return Notification.update({ isRead: true, readAt: new Date() }, { where });
};

const unreadCount = (userId) => Notification.count({ where: { userId, isRead: false } });

module.exports = { notify, notifyMany, markRead, unreadCount };
