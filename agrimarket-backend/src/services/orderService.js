const env = require('../config/env');
const { Order, Listing, User, Produce, Transaction, sequelize } = require('../models');
const { generateCode } = require('../utils/helpers');
const { sendSms } = require('./smsService');
const { notify } = require('./notificationService');
const { activity } = require('../sockets/io');
const ApiError = require('../utils/ApiError');

const ORDER_INCLUDES = [
  {
    model: Listing,
    as: 'listing',
    include: [{ model: Produce, as: 'produce', attributes: ['id', 'name', 'imageUrl'] }],
  },
  { model: User, as: 'buyer', attributes: ['id', 'uuid', 'fullName', 'phone', 'avatarUrl', 'businessName', 'ratingAvg'] },
  { model: User, as: 'farmer', attributes: ['id', 'uuid', 'fullName', 'phone', 'avatarUrl', 'community', 'ratingAvg'] },
];

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode('ORD');
    if (!(await Order.findOne({ where: { code }, paranoid: false }))) return code;
  }
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Places an order against a listing. Runs in a transaction because reserving
 * stock and creating the order must not drift apart when two buyers hit the
 * same listing from USSD and the website at the same moment.
 */
async function createOrder(payload, { channel = 'web' } = {}) {
  const { listingId, buyerId, quantity } = payload;

  return sequelize.transaction(async (tx) => {
    const listing = await Listing.findByPk(listingId, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!listing) throw ApiError.notFound('That listing no longer exists');
    if (listing.status !== 'active') throw ApiError.badRequest('This listing is no longer available');
    if (listing.farmerId === buyerId) throw ApiError.badRequest('You cannot order your own listing');

    const qty = Number(quantity);
    if (!qty || qty <= 0) throw ApiError.badRequest('Enter a valid quantity');
    if (qty > Number(listing.quantityRemaining)) {
      throw ApiError.badRequest(`Only ${listing.quantityRemaining} ${listing.unit} remaining`);
    }
    if (qty < Number(listing.minOrderQuantity)) {
      throw ApiError.badRequest(`Minimum order is ${listing.minOrderQuantity} ${listing.unit}`);
    }

    const unitPrice = Number(payload.unitPrice || listing.pricePerUnit);
    const subtotal = qty * unitPrice;
    const commission = Number((subtotal * env.platform.commissionRate).toFixed(2));
    const deliveryFee = Number(payload.deliveryFee || 0);
    const totalAmount = subtotal + deliveryFee;

    const order = await Order.create({
      code: await uniqueCode(),
      listingId: listing.id,
      buyerId,
      farmerId: listing.farmerId,
      quantity: qty,
      unit: listing.unit,
      unitPrice,
      subtotal,
      commission,
      deliveryFee,
      totalAmount,
      farmerPayout: subtotal - commission,
      paymentMethod: payload.paymentMethod || 'momo',
      deliveryMethod: payload.deliveryMethod || 'pickup',
      deliveryAddress: payload.deliveryAddress || null,
      deliveryContact: payload.deliveryContact || null,
      expectedDeliveryDate: payload.expectedDeliveryDate || null,
      notes: payload.notes || null,
      source: channel,
      status: 'pending',
      timeline: [{ status: 'pending', note: 'Order placed', actor: 'buyer', at: new Date().toISOString() }],
    }, { transaction: tx });

    // Reserve the stock straight away so the marketplace never oversells
    const remaining = Number(listing.quantityRemaining) - qty;
    await listing.update(
      { quantityRemaining: remaining, status: remaining <= 0 ? 'reserved' : listing.status },
      { transaction: tx }
    );

    return order;
  }).then(async (order) => {
    await dispatchNewOrderAlerts(order);
    return getOrder(order.id);
  });
}

/** Objective 2: both sides hear about the order within seconds, by SMS. */
async function dispatchNewOrderAlerts(order) {
  const full = await getOrder(order.id);
  const produceName = full.listing?.produce?.name || 'produce';

  await sendSms({
    to: full.farmer.phone,
    userId: full.farmerId,
    template: 'newOrderFarmer',
    data: {
      orderCode: full.code,
      produce: produceName,
      quantity: full.quantity,
      unit: full.unit,
      amount: full.totalAmount,
      buyerName: full.buyer.businessName || full.buyer.fullName,
      buyerPhone: full.buyer.phone,
    },
    type: 'order',
    relatedType: 'order',
    relatedId: full.id,
    force: true,
  });

  await sendSms({
    to: full.buyer.phone,
    userId: full.buyerId,
    template: 'orderPlacedBuyer',
    data: {
      orderCode: full.code,
      produce: produceName,
      quantity: full.quantity,
      unit: full.unit,
      amount: full.totalAmount,
      farmerName: full.farmer.fullName,
    },
    type: 'order',
    relatedType: 'order',
    relatedId: full.id,
    force: true,
  });

  await notify({
    userId: full.farmerId,
    title: `New order ${full.code}`,
    message: `${full.buyer.fullName} ordered ${full.quantity} ${full.unit} of ${produceName} for GHS ${full.totalAmount}.`,
    type: 'order',
    priority: 'high',
    icon: 'ShoppingCart',
    link: `/dashboard/orders/${full.code}`,
    relatedType: 'order',
    relatedId: full.id,
  });

  activity('order.created', `Order ${full.code} placed for ${produceName}`, {
    orderId: full.id,
    amount: full.totalAmount,
  });
}

/** Validated status graph — prevents a delivered order sliding back to pending. */
const TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  // accepted -> delivered covers cash-on-pickup, where nothing is paid or shipped in between
  accepted: ['paid', 'in_transit', 'delivered', 'cancelled', 'disputed'],
  paid: ['in_transit', 'delivered', 'disputed', 'cancelled'],
  in_transit: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  rejected: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

async function updateOrderStatus(orderId, nextStatus, { actor = 'system', note = null, reason = null } = {}) {
  const order = await Order.findByPk(orderId);
  if (!order) throw ApiError.notFound('Order not found');

  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.badRequest(`An order that is "${order.status}" cannot move to "${nextStatus}"`);
  }

  const patch = { status: nextStatus };
  if (nextStatus === 'accepted') patch.acceptedAt = new Date();
  if (nextStatus === 'delivered') patch.deliveredAt = new Date();
  if (nextStatus === 'paid') patch.paymentStatus = 'paid';
  if (nextStatus === 'completed') {
    patch.completedAt = new Date();
    patch.paymentStatus = order.paymentStatus === 'paid' ? 'paid' : order.paymentStatus;
  }
  if (nextStatus === 'rejected' || nextStatus === 'cancelled') patch.cancellationReason = reason;

  order.pushTimeline(nextStatus, note || reason, actor);
  await order.update({ ...patch, timeline: order.timeline });

  // Returning stock to the listing when a deal falls through
  if (['rejected', 'cancelled'].includes(nextStatus)) {
    const listing = await Listing.findByPk(order.listingId);
    if (listing) {
      const restored = Number(listing.quantityRemaining) + Number(order.quantity);
      await listing.update({
        quantityRemaining: restored,
        status: listing.status === 'reserved' || listing.status === 'sold' ? 'active' : listing.status,
      });
    }
  }

  if (nextStatus === 'completed') await settleOrder(order);

  await dispatchStatusAlerts(order, nextStatus, reason);
  activity(`order.${nextStatus}`, `Order ${order.code} is now ${nextStatus}`, { orderId: order.id });

  return getOrder(order.id);
}

/** Credits the farmer's wallet and books the platform commission. */
async function settleOrder(order) {
  const farmer = await User.findByPk(order.farmerId);
  if (!farmer) return;

  const payout = Number(order.farmerPayout || order.subtotal);
  const balance = Number(farmer.walletBalance || 0) + payout;

  await Transaction.create({
    reference: generateCode('TXN', 8),
    userId: farmer.id,
    orderId: order.id,
    type: 'payout',
    direction: 'credit',
    amount: payout,
    fee: Number(order.commission || 0),
    balanceAfter: balance,
    method: order.paymentMethod === 'cash' ? 'cash' : 'momo',
    provider: 'internal',
    status: 'success',
    description: `Sale proceeds for order ${order.code}`,
    processedAt: new Date(),
  });

  await farmer.update({
    walletBalance: balance,
    totalSales: Number(farmer.totalSales || 0) + Number(order.subtotal),
  });

  const buyer = await User.findByPk(order.buyerId);
  if (buyer) {
    await buyer.update({ totalPurchases: Number(buyer.totalPurchases || 0) + Number(order.totalAmount) });
  }

  const listing = await Listing.findByPk(order.listingId);
  if (listing && Number(listing.quantityRemaining) <= 0) {
    await listing.update({ status: 'sold', soldAt: new Date() });
  }
}

async function dispatchStatusAlerts(order, status, reason) {
  const full = await getOrder(order.id);
  const produceName = full.listing?.produce?.name || 'produce';

  const plans = {
    accepted: [{
      to: full.buyer, tpl: 'orderAccepted',
      data: { orderCode: full.code, farmerName: full.farmer.fullName, farmerPhone: full.farmer.phone, produce: produceName },
      title: `Order ${full.code} accepted`,
      body: `${full.farmer.fullName} accepted your order. Call ${full.farmer.phone} to arrange pickup.`,
    }],
    rejected: [{
      to: full.buyer, tpl: 'orderRejected',
      data: { orderCode: full.code, reason },
      title: `Order ${full.code} declined`,
      body: reason || 'The farmer could not fulfil this order.',
    }],
    completed: [
      { to: full.buyer, tpl: 'orderCompleted', data: { orderCode: full.code, amount: full.totalAmount }, title: `Order ${full.code} completed`, body: 'Thank you for trading on AgriMart.' },
      { to: full.farmer, tpl: 'orderCompleted', data: { orderCode: full.code, amount: full.farmerPayout }, title: `Order ${full.code} completed`, body: `GHS ${full.farmerPayout} has been credited to your wallet.` },
    ],
    cancelled: [
      { to: full.buyer, tpl: 'orderCancelled', data: { orderCode: full.code, reason }, title: `Order ${full.code} cancelled`, body: reason || 'The order was cancelled.' },
      { to: full.farmer, tpl: 'orderCancelled', data: { orderCode: full.code, reason }, title: `Order ${full.code} cancelled`, body: reason || 'The order was cancelled.' },
    ],
  };

  const plan = plans[status];
  if (!plan) return;

  await Promise.allSettled(plan.map(async (p) => {
    await sendSms({
      to: p.to.phone, userId: p.to.id, template: p.tpl, data: p.data,
      type: 'order', relatedType: 'order', relatedId: full.id, force: true,
    });
    await notify({
      userId: p.to.id, title: p.title, message: p.body, type: 'order',
      priority: 'high', icon: 'Package', link: `/dashboard/orders/${full.code}`,
      relatedType: 'order', relatedId: full.id,
    });
  }));
}

const getOrder = (idOrCode) => {
  const where = /^\d+$/.test(String(idOrCode)) ? { id: idOrCode } : { code: idOrCode };
  return Order.findOne({ where, include: ORDER_INCLUDES });
};

module.exports = { createOrder, updateOrderStatus, getOrder, settleOrder, ORDER_INCLUDES, TRANSITIONS };
