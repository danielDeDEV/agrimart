const { Order, Listing, User, Produce, Review, SupportTicket, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const orderService = require('../services/orderService');
const { LIKE } = require('../utils/search');
const auditService = require('../services/auditService');
const upload = require('../middleware/upload');
const storage = require('../services/storageService');
const { sendSms } = require('../services/smsService');
const { notify } = require('../services/notificationService');
const { activity } = require('../sockets/io');
const { generateCode, formatMoneyShort } = require('../utils/helpers');

/** POST /orders */
exports.create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(
    { ...req.body, buyerId: req.user.id },
    { channel: 'web' }
  );
  return created(res, order, `Order ${order.code} placed. The farmer has been notified by SMS.`);
});

/** GET /orders — role aware: buyers see purchases, farmers see sales. */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { role } = req.query;

  const where = {};
  if (role === 'buying') where.buyerId = req.user.id;
  else if (role === 'selling') where.farmerId = req.user.id;
  else where[Op.or] = [{ buyerId: req.user.id }, { farmerId: req.user.id }];

  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where.code = { [LIKE]: `%${req.query.search}%` };

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: orderService.ORDER_INCLUDES,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /orders/:code */
exports.getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.code);
  if (!order) throw ApiError.notFound('Order not found');

  const isParty = [order.buyerId, order.farmerId].includes(req.user.id);
  if (!isParty && !req.user.isAdmin()) throw ApiError.forbidden('This order is not yours');

  return ok(res, order);
});

/**
 * PATCH /orders/:id/status — the single door for every status change, so the
 * transition rules and the SMS notifications stay in one place.
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, reason, note } = req.body;
  const order = await Order.findByPk(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');

  const isFarmer = order.farmerId === req.user.id;
  const isBuyer = order.buyerId === req.user.id;
  if (!isFarmer && !isBuyer && !req.user.isAdmin()) throw ApiError.forbidden('This order is not yours');

  // Who is allowed to drive which transition
  const permissions = {
    accepted: isFarmer,
    rejected: isFarmer,
    in_transit: isFarmer,
    delivered: isFarmer || isBuyer,
    completed: isBuyer,
    cancelled: isBuyer || isFarmer,
    // The farmer confirms the money arrived; the buyer records the proof
    paid: isFarmer,
    disputed: isBuyer || isFarmer,
  };

  if (!req.user.isAdmin() && !permissions[status]) {
    throw ApiError.forbidden(`You are not able to move this order to "${status}"`);
  }

  const actor = req.user.isAdmin() ? 'admin' : isFarmer ? 'farmer' : 'buyer';
  const updated = await orderService.updateOrderStatus(order.id, status, { actor, reason, note });

  if (req.user.isAdmin()) {
    await auditService.record(req, {
      action: `order.${status}`, entity: 'order', entityId: order.id,
      description: `Order ${order.code} moved to ${status}`,
    });
  }

  return ok(res, updated, `Order ${order.code} is now ${status}`);
});


/**
 * POST /orders/:id/payment — the buyer records a payment they made directly to
 * the farmer. AgriMart never holds the money, so this is a record with evidence
 * (a mobile-money reference and screenshots), not a transfer. The farmer checks
 * it against their own messages and confirms, which is what marks the order paid.
 */
exports.recordPayment = asyncHandler(async (req, res) => {
  const files = await storage.saveAll(req.files, 'evidence');
  const reject = (error) => {
    files.forEach(upload.removeStoredFile);
    throw error;
  };

  const order = await Order.findByPk(req.params.id);
  if (!order) reject(ApiError.notFound('Order not found'));
  if (order.buyerId !== req.user.id) reject(ApiError.forbidden('Only the buyer records a payment on this order'));
  if (['completed', 'cancelled', 'rejected'].includes(order.status)) {
    reject(ApiError.badRequest(`This order is ${order.status}, so a payment cannot be added`));
  }

  const { reference, method = order.paymentMethod, note, amount } = req.body;
  if (!reference && !files.length) {
    reject(ApiError.badRequest('Add the payment reference or a screenshot so the farmer can check it'));
  }

  const proof = {
    reference: reference ? String(reference).trim().substring(0, 80) : null,
    method,
    amount: amount ? Number(amount) : Number(order.totalAmount),
    note: note ? String(note).substring(0, 500) : null,
    images: files,
    recordedAt: new Date().toISOString(),
  };

  order.pushTimeline('payment_reported', `Buyer recorded a ${method} payment${proof.reference ? ` (ref ${proof.reference})` : ''}`, 'buyer');
  await order.update({
    paymentProof: proof,
    paymentMethod: method,
    paymentReference: proof.reference,
    paymentStatus: 'pending',
    timeline: order.timeline,
  });

  const farmer = await User.findByPk(order.farmerId);
  const buyer = await User.findByPk(order.buyerId);
  if (farmer) {
    await sendSms({
      to: farmer.phone,
      userId: farmer.id,
      message: `AgriMart: ${buyer?.fullName || 'The buyer'} says they paid ${formatMoneyShort(proof.amount)} for order ${order.code}`
        + `${proof.reference ? ` (ref ${proof.reference})` : ''}. Check your ${String(method).toUpperCase()} messages, then confirm on the website.`,
      type: 'payment',
      relatedType: 'order',
      relatedId: order.id,
      force: true,
    });
    await notify({
      userId: farmer.id,
      title: `Payment reported for ${order.code}`,
      message: `${buyer?.fullName || 'The buyer'} recorded a payment of ${formatMoneyShort(proof.amount)}. Confirm once the money is in your account.`,
      type: 'payment',
      icon: 'BadgeCheck',
      link: `/dashboard/orders/${order.code}`,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  return ok(res, await orderService.getOrder(order.id), 'Payment recorded. The farmer will confirm once the money arrives.');
});

/**
 * POST /orders/:id/report — either party reports a problem with the order and
 * attaches screenshots. It opens a support ticket tied to the order so the
 * desk can see the evidence and the full order timeline in one place.
 */
exports.report = asyncHandler(async (req, res) => {
  const files = await storage.saveAll(req.files, 'evidence');
  const reject = (error) => {
    files.forEach(upload.removeStoredFile);
    throw error;
  };

  const order = await Order.findByPk(req.params.id);
  if (!order) reject(ApiError.notFound('Order not found'));

  const isBuyer = order.buyerId === req.user.id;
  const isFarmer = order.farmerId === req.user.id;
  if (!isBuyer && !isFarmer) reject(ApiError.forbidden('This order is not yours'));

  const { category = 'order', message, subject } = req.body;
  if (!message || String(message).trim().length < 10) {
    reject(ApiError.badRequest('Tell us what went wrong, in a sentence or two'));
  }

  const ticket = await SupportTicket.create({
    code: generateCode('TKT'),
    userId: req.user.id,
    orderId: order.id,
    name: req.user.fullName,
    phone: req.user.phone,
    email: req.user.email,
    subject: subject || `Problem with order ${order.code}`,
    category: ['order', 'payment'].includes(category) ? category : 'order',
    message: String(message).trim(),
    attachments: files,
    channel: 'web',
    priority: category === 'payment' ? 'high' : 'normal',
  });

  // A reported problem also freezes the order, so nobody is chased for a rating
  const disputable = (orderService.TRANSITIONS[order.status] || []).includes('disputed');
  if (disputable) {
    await orderService.updateOrderStatus(order.id, 'disputed', {
      actor: isFarmer ? 'farmer' : 'buyer',
      reason: String(message).trim().substring(0, 250),
      note: `Reported to support as ${ticket.code}`,
    });
  }

  activity('support.ticket', `${req.user.fullName} reported a problem with ${order.code}`, {
    ticketId: ticket.id, orderId: order.id,
  });

  await sendSms({
    to: req.user.phone,
    userId: req.user.id,
    template: 'supportTicket',
    data: { code: ticket.code },
    type: 'support',
    relatedType: 'ticket',
    relatedId: ticket.id,
    force: true,
  });

  return created(res, {
    ticket: { code: ticket.code, attachments: ticket.attachments },
    order: await orderService.getOrder(order.id),
  }, `Reported. Your reference is ${ticket.code} — our team reviews it and contacts both sides.`);
});

/** POST /orders/:id/review */
exports.review = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'completed') throw ApiError.badRequest('You can review once the order is completed');

  const isFarmer = order.farmerId === req.user.id;
  const isBuyer = order.buyerId === req.user.id;
  if (!isFarmer && !isBuyer) throw ApiError.forbidden('This order is not yours');

  const existing = await Review.findOne({ where: { orderId: order.id, reviewerId: req.user.id } });
  if (existing) throw ApiError.conflict('You have already reviewed this order');

  const revieweeId = isFarmer ? order.buyerId : order.farmerId;
  const review = await Review.create({
    orderId: order.id,
    reviewerId: req.user.id,
    revieweeId,
    reviewerRole: isFarmer ? 'farmer' : 'buyer',
    rating: req.body.rating,
    qualityRating: req.body.qualityRating,
    communicationRating: req.body.communicationRating,
    punctualityRating: req.body.punctualityRating,
    comment: req.body.comment,
  });

  // Recompute the reviewee's running average
  const stats = await Review.findAll({
    where: { revieweeId, isPublished: true },
    attributes: ['rating'],
    raw: true,
  });
  const avg = stats.reduce((sum, r) => sum + r.rating, 0) / stats.length;
  await User.update(
    { ratingAvg: Number(avg.toFixed(2)), ratingCount: stats.length },
    { where: { id: revieweeId } }
  );

  await order.update(isFarmer ? { farmerRated: true } : { buyerRated: true });

  return created(res, review, 'Thank you for your feedback');
});

/** GET /orders/stats — the numbers on the user dashboard. */
exports.stats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const asBuyer = { buyerId: userId };
  const asFarmer = { farmerId: userId };

  const [
    totalPurchases, pendingPurchases, totalSales, pendingSales,
    completedSales, completedPurchases,
  ] = await Promise.all([
    Order.count({ where: asBuyer }),
    Order.count({ where: { ...asBuyer, status: ['pending', 'accepted', 'paid', 'in_transit'] } }),
    Order.count({ where: asFarmer }),
    Order.count({ where: { ...asFarmer, status: 'pending' } }),
    Order.count({ where: { ...asFarmer, status: 'completed' } }),
    Order.count({ where: { ...asBuyer, status: 'completed' } }),
  ]);

  const [salesValue, purchaseValue] = await Promise.all([
    Order.sum('farmerPayout', { where: { ...asFarmer, status: 'completed' } }),
    Order.sum('totalAmount', { where: { ...asBuyer, status: 'completed' } }),
  ]);

  return ok(res, {
    purchases: { total: totalPurchases, pending: pendingPurchases, completed: completedPurchases, value: purchaseValue || 0 },
    sales: { total: totalSales, pending: pendingSales, completed: completedSales, value: salesValue || 0 },
  });
});
