const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

/** GET /notifications */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const where = { userId: req.user.id };
  if (req.query.unread === 'true') where.isRead = false;
  if (req.query.type) where.type = req.query.type;

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const unread = await notificationService.unreadCount(req.user.id);
  return paginated(res, rows, { page, limit, total: count }, `${unread} unread`);
});

/** GET /notifications/unread-count */
exports.unreadCount = asyncHandler(async (req, res) => {
  return ok(res, { count: await notificationService.unreadCount(req.user.id) });
});

/** PATCH /notifications/read */
exports.markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user.id, req.body.ids);
  return ok(res, { unread: await notificationService.unreadCount(req.user.id) }, 'Marked as read');
});

/** DELETE /notifications/:id */
exports.remove = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!notification) throw ApiError.notFound('Notification not found');
  await notification.destroy();
  return ok(res, null, 'Notification removed');
});

/** DELETE /notifications */
exports.clearAll = asyncHandler(async (req, res) => {
  await Notification.destroy({ where: { userId: req.user.id } });
  return ok(res, null, 'All notifications cleared');
});
