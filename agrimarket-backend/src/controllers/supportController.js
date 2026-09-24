const { SupportTicket, User, Order, Op } = require('../models');
const upload = require('../middleware/upload');
const storage = require('../services/storageService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate, generateCode, normalizePhone } = require('../utils/helpers');
const { LIKE, orderByValues } = require('../utils/search');
const { sendSms } = require('../services/smsService');
const { notify } = require('../services/notificationService');
const auditService = require('../services/auditService');
const { activity } = require('../sockets/io');

/** POST /support — public contact form and signed-in help requests. */
exports.create = asyncHandler(async (req, res) => {
  const { name, phone, email, subject, category, message } = req.body;
  // Screenshots are optional but often the fastest way to understand a problem
  const attachments = await storage.saveAll(req.files, 'evidence');

  const ticket = await SupportTicket.create({
    code: generateCode('TKT'),
    userId: req.user?.id || null,
    name: name || req.user?.fullName,
    phone: normalizePhone(phone || req.user?.phone),
    email: email || req.user?.email,
    subject,
    category: category || 'other',
    message,
    attachments,
    channel: 'web',
    priority: category === 'payment' ? 'high' : 'normal',
  });

  if (ticket.phone) {
    await sendSms({
      to: ticket.phone,
      userId: ticket.userId,
      template: 'supportTicket',
      data: { code: ticket.code },
      type: 'support',
      relatedType: 'ticket',
      relatedId: ticket.id,
    });
  }

  activity('support.ticket', `New support ticket ${ticket.code}: ${subject}`, { ticketId: ticket.id });

  return created(res, { code: ticket.code }, `Thank you. Your reference is ${ticket.code} — we reply within 24 hours.`);
});

/** GET /support/mine */
exports.mine = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.findAll({
    where: { userId: req.user.id },
    include: [{ model: Order, as: 'order', attributes: ['id', 'code', 'status', 'totalAmount'], required: false }],
    order: [['createdAt', 'DESC']],
  });
  return ok(res, tickets);
});

/** GET /admin/support */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.category) where.category = req.query.category;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    where[Op.or] = [
      { code: { [LIKE]: term } },
      { subject: { [LIKE]: term } },
      { message: { [LIKE]: term } },
      { phone: { [LIKE]: term } },
    ];
  }

  const { rows, count } = await SupportTicket.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'role', 'avatarUrl'] },
      { model: User, as: 'assignee', attributes: ['id', 'fullName'] },
      { model: Order, as: 'order', attributes: ['id', 'code', 'status', 'totalAmount', 'paymentProof'], required: false },
    ],
    order: [
      [orderByValues(require('../models').sequelize, 'priority', ['urgent', 'high', 'normal', 'low']), 'ASC'],
      ['createdAt', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** PATCH /admin/support/:id — respond, reassign or close. */
exports.update = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findByPk(req.params.id);
  if (!ticket) throw ApiError.notFound('Ticket not found');

  const { response, status, priority, assignedTo, notifyUser = true } = req.body;
  const patch = {};

  if (response) {
    patch.response = response;
    patch.respondedAt = new Date();
    patch.status = status || 'resolved';
  }
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (assignedTo !== undefined) patch.assignedTo = assignedTo;
  if (patch.status === 'resolved' || patch.status === 'closed') patch.resolvedAt = new Date();

  await ticket.update(patch);

  if (response && notifyUser) {
    if (ticket.phone) {
      await sendSms({
        to: ticket.phone,
        userId: ticket.userId,
        message: `AgriMart: Re ${ticket.code} - ${String(response).substring(0, 220)}`,
        type: 'support',
        relatedType: 'ticket',
        relatedId: ticket.id,
        force: true,
      });
    }
    if (ticket.userId) {
      await notify({
        userId: ticket.userId,
        title: `Reply to ${ticket.code}`,
        message: response,
        type: 'support',
        icon: 'LifeBuoy',
        link: '/dashboard/support',
      });
    }
  }

  await auditService.record(req, {
    action: 'support.update',
    entity: 'ticket',
    entityId: ticket.id,
    description: `Updated ticket ${ticket.code} → ${ticket.status}`,
  });

  return ok(res, ticket, 'Ticket updated');
});

/** GET /admin/support/stats */
exports.stats = asyncHandler(async (_req, res) => {
  const [open, inProgress, resolved, urgent] = await Promise.all([
    SupportTicket.count({ where: { status: 'open' } }),
    SupportTicket.count({ where: { status: 'in_progress' } }),
    SupportTicket.count({ where: { status: ['resolved', 'closed'] } }),
    SupportTicket.count({ where: { priority: 'urgent', status: ['open', 'in_progress'] } }),
  ]);
  return ok(res, { open, inProgress, resolved, urgent, total: open + inProgress + resolved });
});
