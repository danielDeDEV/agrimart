const { Offer, Listing, User, Produce, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate, generateCode } = require('../utils/helpers');
const { sendSms } = require('../services/smsService');
const { notify } = require('../services/notificationService');
const orderService = require('../services/orderService');
const env = require('../config/env');

const OFFER_INCLUDES = [
  {
    model: Listing,
    as: 'listing',
    include: [{ model: Produce, as: 'produce', attributes: ['id', 'name', 'imageUrl'] }],
  },
  { model: User, as: 'buyer', attributes: ['id', 'fullName', 'phone', 'businessName', 'avatarUrl', 'ratingAvg'] },
  { model: User, as: 'farmer', attributes: ['id', 'fullName', 'phone', 'avatarUrl', 'ratingAvg'] },
];

/** POST /offers — a buyer negotiates on a listing. */
exports.create = asyncHandler(async (req, res) => {
  const { listingId, offerPrice, quantity, message } = req.body;

  const listing = await Listing.findByPk(listingId, {
    include: [{ model: Produce, as: 'produce' }, { model: User, as: 'farmer' }],
  });
  if (!listing) throw ApiError.notFound('Listing not found');
  if (listing.status !== 'active') throw ApiError.badRequest('This listing is no longer open to offers');
  if (listing.farmerId === req.user.id) throw ApiError.badRequest('You cannot bid on your own listing');
  if (!listing.negotiable) throw ApiError.badRequest('The farmer has set a fixed price on this listing');
  if (Number(quantity) > Number(listing.quantityRemaining)) {
    throw ApiError.badRequest(`Only ${listing.quantityRemaining} ${listing.unit} remaining`);
  }
  // An offer below the minimum could be accepted but never turned into an order
  if (Number(quantity) < Number(listing.minOrderQuantity)) {
    throw ApiError.badRequest(`The minimum order on this listing is ${listing.minOrderQuantity} ${listing.unit}`);
  }

  const pending = await Offer.findOne({
    where: { listingId, buyerId: req.user.id, status: ['pending', 'countered'] },
  });
  if (pending) throw ApiError.conflict('You already have an open offer on this listing');

  const offer = await Offer.create({
    code: generateCode('OFR'),
    listingId,
    buyerId: req.user.id,
    farmerId: listing.farmerId,
    offerPrice,
    quantity,
    unit: listing.unit,
    message,
    source: 'web',
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
  await listing.increment('offerCount');

  await sendSms({
    to: listing.farmer.phone,
    userId: listing.farmerId,
    template: 'newOffer',
    data: {
      listingCode: listing.code,
      produce: listing.produce.name,
      offerPrice,
      unit: listing.unit,
      quantity,
      buyerName: req.user.businessName || req.user.fullName,
    },
    type: 'offer',
    relatedType: 'offer',
    relatedId: offer.id,
  });

  await notify({
    userId: listing.farmerId,
    title: `New offer on ${listing.code}`,
    message: `${req.user.fullName} offered GHS ${offerPrice}/${listing.unit} for ${quantity} ${listing.unit} of ${listing.produce.name}.`,
    type: 'offer',
    priority: 'high',
    icon: 'HandCoins',
    link: '/dashboard/offers',
    relatedType: 'offer',
    relatedId: offer.id,
  });

  return created(res, await Offer.findByPk(offer.id, { include: OFFER_INCLUDES }), 'Offer sent to the farmer');
});

/** GET /offers */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const where = {};

  if (req.query.role === 'received') where.farmerId = req.user.id;
  else if (req.query.role === 'sent') where.buyerId = req.user.id;
  else where[Op.or] = [{ farmerId: req.user.id }, { buyerId: req.user.id }];

  if (req.query.status) where.status = req.query.status;

  const { rows, count } = await Offer.findAndCountAll({
    where,
    include: OFFER_INCLUDES,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** PATCH /offers/:id — accept, reject, counter or withdraw. */
exports.respond = asyncHandler(async (req, res) => {
  const { action, counterPrice, counterMessage } = req.body;
  const offer = await Offer.findByPk(req.params.id, { include: OFFER_INCLUDES });
  if (!offer) throw ApiError.notFound('Offer not found');

  const isFarmer = offer.farmerId === req.user.id;
  const isBuyer = offer.buyerId === req.user.id;
  if (!isFarmer && !isBuyer) throw ApiError.forbidden('This offer is not yours');
  if (!['pending', 'countered'].includes(offer.status)) {
    throw ApiError.badRequest('This offer has already been closed');
  }

  if (action === 'withdraw') {
    if (!isBuyer) throw ApiError.forbidden('Only the buyer can withdraw an offer');
    await offer.update({ status: 'withdrawn', respondedAt: new Date() });
    return ok(res, offer, 'Offer withdrawn');
  }

  if (!isFarmer) throw ApiError.forbidden('Only the farmer can respond to this offer');

  if (action === 'reject') {
    await offer.update({ status: 'rejected', respondedAt: new Date() });
    await sendSms({
      to: offer.buyer.phone,
      userId: offer.buyerId,
      template: 'offerRejected',
      data: { listingCode: offer.listing.code, produce: offer.listing.produce.name },
      type: 'offer',
    });
    await notify({
      userId: offer.buyerId,
      title: 'Offer declined',
      message: `Your offer on ${offer.listing.code} was declined.`,
      type: 'offer',
      icon: 'X',
      link: '/dashboard/offers',
    });
    return ok(res, offer, 'Offer declined');
  }

  if (action === 'counter') {
    if (!counterPrice) throw ApiError.badRequest('Enter your counter price');
    await offer.update({ status: 'countered', counterPrice, counterMessage, respondedAt: new Date() });
    await sendSms({
      to: offer.buyer.phone,
      userId: offer.buyerId,
      message: `AgriMart: The farmer countered your offer on ${offer.listing.code} at GHS ${counterPrice}/${offer.unit}. Sign in or dial ${env.ussd.serviceCode} to respond.`,
      type: 'offer',
    });
    await notify({
      userId: offer.buyerId,
      title: 'Counter offer received',
      message: `The farmer countered at GHS ${counterPrice}/${offer.unit} for ${offer.listing.produce.name}.`,
      type: 'offer',
      priority: 'high',
      icon: 'ArrowLeftRight',
      link: '/dashboard/offers',
    });
    return ok(res, offer, 'Counter offer sent');
  }

  if (action === 'accept') {
    const agreedPrice = offer.status === 'countered' ? offer.counterPrice : offer.offerPrice;

    const order = await orderService.createOrder({
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      quantity: offer.quantity,
      unitPrice: agreedPrice,
      notes: `Created from accepted offer ${offer.code}`,
    }, { channel: offer.source });

    await offer.update({ status: 'accepted', respondedAt: new Date() });

    await sendSms({
      to: offer.buyer.phone,
      userId: offer.buyerId,
      template: 'offerAccepted',
      data: {
        listingCode: offer.listing.code,
        produce: offer.listing.produce.name,
        price: agreedPrice,
        farmerPhone: offer.farmer.phone,
      },
      type: 'offer',
      force: true,
    });

    return ok(res, { offer, order }, `Offer accepted — order ${order.code} created`);
  }

  throw ApiError.badRequest('Unknown action. Use accept, reject, counter or withdraw.');
});

/** POST /offers/:id/accept-counter — buyer accepts the farmer's counter price. */
exports.acceptCounter = asyncHandler(async (req, res) => {
  const offer = await Offer.findByPk(req.params.id, { include: OFFER_INCLUDES });
  if (!offer) throw ApiError.notFound('Offer not found');
  if (offer.buyerId !== req.user.id) throw ApiError.forbidden('This offer is not yours');
  if (offer.status !== 'countered') throw ApiError.badRequest('There is no counter offer to accept');

  const order = await orderService.createOrder({
    listingId: offer.listingId,
    buyerId: offer.buyerId,
    quantity: offer.quantity,
    unitPrice: offer.counterPrice,
    notes: `Created from counter offer ${offer.code}`,
  }, { channel: 'web' });

  await offer.update({ status: 'accepted', respondedAt: new Date() });
  return ok(res, { offer, order }, `Counter offer accepted — order ${order.code} created`);
});
