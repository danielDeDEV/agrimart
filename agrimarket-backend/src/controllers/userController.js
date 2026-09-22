const {
  User, Region, District, Listing, Order, Review, Produce,
  Transaction, Notification, Op, sequelize,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { get: setting } = require('../services/settingsService');
const { ok, paginated } = require('../utils/response');
const { paginate, normalizePhone, daysAgo } = require('../utils/helpers');
const upload = require('../middleware/upload');

const PROFILE_INCLUDES = [
  { model: Region, as: 'region', attributes: ['id', 'name'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
];

/** PATCH /users/me */
exports.updateProfile = asyncHandler(async (req, res) => {
  const editable = [
    'fullName', 'email', 'regionId', 'districtId', 'community', 'address',
    'language', 'gender', 'dateOfBirth', 'bio', 'farmSize', 'farmingExperience',
    'primaryCrops', 'cooperative', 'businessName', 'businessType', 'businessRegNumber',
    'momoNumber', 'momoProvider', 'smsNotifications', 'priceAlerts', 'latitude', 'longitude',
  ];

  const patch = {};
  editable.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

  if (req.body.phone) {
    const normalized = normalizePhone(req.body.phone);
    if (normalized !== req.user.phone) {
      const taken = await User.findOne({ where: { phone: normalized, id: { [Op.ne]: req.user.id } } });
      if (taken) throw ApiError.conflict('That phone number belongs to another account');
      patch.phone = normalized;
      patch.isPhoneVerified = false;
    }
  }

  await req.user.update(patch);
  const user = await User.findByPk(req.user.id, { include: PROFILE_INCLUDES });
  return ok(res, user, 'Profile updated');
});

/** POST /users/me/avatar */
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const url = upload.publicUrl(req, 'avatars', req.file.filename);
  await req.user.update({ avatarUrl: url });
  return ok(res, { avatarUrl: url }, 'Profile photo updated');
});

/** GET /users/:uuid — public seller/buyer profile. */
exports.publicProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    where: { uuid: req.params.uuid },
    attributes: [
      'id', 'uuid', 'fullName', 'role', 'avatarUrl', 'bio', 'community', 'regionId',
      'ratingAvg', 'ratingCount', 'isVerifiedSeller', 'businessName', 'businessType',
      'farmSize', 'farmingExperience', 'cooperative', 'primaryCrops', 'createdAt',
    ],
    include: PROFILE_INCLUDES,
  });
  if (!user) throw ApiError.notFound('That profile does not exist');

  const [listings, completedOrders, reviews] = await Promise.all([
    Listing.findAll({
      where: { farmerId: user.id, status: 'active' },
      include: [{ model: Produce, as: 'produce', attributes: ['id', 'name', 'imageUrl'] }],
      limit: 12,
      order: [['createdAt', 'DESC']],
    }),
    Order.count({ where: { [Op.or]: [{ farmerId: user.id }, { buyerId: user.id }], status: 'completed' } }),
    Review.findAll({
      where: { revieweeId: user.id, isPublished: true },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'avatarUrl'] }],
      limit: 10,
      order: [['createdAt', 'DESC']],
    }),
  ]);

  return ok(res, { user, listings, completedOrders, reviews });
});

/**
 * GET /users/me/dashboard — everything the signed-in dashboard needs in one
 * round trip, shaped by whether the account mainly sells or mainly buys.
 */
exports.dashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isFarmer = req.user.role === 'farmer';

  const [
    activeListings, totalListings, soldListings,
    pendingOrders, activeOrders, completedOrders,
    unreadNotifications,
  ] = await Promise.all([
    Listing.count({ where: { farmerId: userId, status: 'active' } }),
    Listing.count({ where: { farmerId: userId } }),
    Listing.count({ where: { farmerId: userId, status: 'sold' } }),
    Order.count({ where: isFarmer ? { farmerId: userId, status: 'pending' } : { buyerId: userId, status: 'pending' } }),
    Order.count({
      where: {
        [Op.or]: [{ farmerId: userId }, { buyerId: userId }],
        status: ['accepted', 'paid', 'in_transit', 'delivered'],
      },
    }),
    Order.count({ where: { [Op.or]: [{ farmerId: userId }, { buyerId: userId }], status: 'completed' } }),
    Notification.count({ where: { userId, isRead: false } }),
  ]);

  const [revenue, spend, viewsRow] = await Promise.all([
    Order.sum('farmerPayout', { where: { farmerId: userId, status: 'completed' } }),
    Order.sum('totalAmount', { where: { buyerId: userId, status: 'completed' } }),
    Listing.findOne({
      where: { farmerId: userId },
      attributes: [[sequelize.fn('SUM', sequelize.col('views')), 'views']],
      raw: true,
    }),
  ]);

  // Last 6 months of trading activity for the dashboard chart
  const since = daysAgo(180);
  const monthly = await Order.findAll({
    where: {
      [Op.or]: [{ farmerId: userId }, { buyerId: userId }],
      createdAt: { [Op.gte]: since },
    },
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'month'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      [sequelize.fn('SUM', sequelize.col('totalAmount')), 'value'],
    ],
    group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')],
    order: [[sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
    raw: true,
  });

  const recentOrders = await Order.findAll({
    where: { [Op.or]: [{ farmerId: userId }, { buyerId: userId }] },
    include: [
      { model: Listing, as: 'listing', include: [{ model: Produce, as: 'produce', attributes: ['name', 'imageUrl'] }] },
      { model: User, as: 'buyer', attributes: ['id', 'fullName', 'avatarUrl'] },
      { model: User, as: 'farmer', attributes: ['id', 'fullName', 'avatarUrl'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  const recentListings = await Listing.findAll({
    where: { farmerId: userId },
    include: [{ model: Produce, as: 'produce', attributes: ['name', 'imageUrl'] }],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  return ok(res, {
    role: req.user.role,
    stats: {
      activeListings,
      totalListings,
      soldListings,
      pendingOrders,
      activeOrders,
      completedOrders,
      unreadNotifications,
      revenue: Number(revenue || 0),
      spend: Number(spend || 0),
      totalViews: Number(viewsRow?.views || 0),
      walletBalance: Number(req.user.walletBalance || 0),
      rating: Number(req.user.ratingAvg || 0),
    },
    monthly: monthly.map((m) => ({
      month: m.month,
      orders: Number(m.orders),
      value: Number(m.value || 0),
    })),
    recentOrders,
    recentListings,
  });
});

/** GET /users/me/transactions */
exports.transactions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const where = { userId: req.user.id };
  if (req.query.type) where.type = req.query.type;

  const { rows, count } = await Transaction.findAndCountAll({
    where,
    include: [{ model: Order, as: 'order', attributes: ['id', 'code'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  const [credits, debits] = await Promise.all([
    Transaction.sum('netAmount', { where: { userId: req.user.id, direction: 'credit', status: 'success' } }),
    Transaction.sum('netAmount', { where: { userId: req.user.id, direction: 'debit', status: 'success' } }),
  ]);

  return paginated(
    res,
    rows,
    { page, limit, total: count },
    `Balance GHS ${Number(req.user.walletBalance).toFixed(2)}`
  );
});

/** POST /users/me/withdraw */
exports.withdraw = asyncHandler(async (req, res) => {
  const { amount, momoNumber, momoProvider } = req.body;
  const user = await User.findByPk(req.user.id);

  const value = Number(amount);
  const minimum = Number(setting('min_withdrawal'));
  if (!value || value < minimum) throw ApiError.badRequest(`The minimum withdrawal is GHS ${minimum}`);
  if (value > Number(user.walletBalance)) throw ApiError.badRequest('That is more than your wallet balance');

  const target = normalizePhone(momoNumber || user.momoNumber || user.phone);
  const fee = Number((value * Number(setting('withdrawal_fee_rate'))).toFixed(2));
  const balance = Number(user.walletBalance) - value;

  const { generateCode } = require('../utils/helpers');
  const tx = await Transaction.create({
    reference: generateCode('TXN', 8),
    userId: user.id,
    type: 'withdrawal',
    direction: 'debit',
    amount: value,
    fee,
    balanceAfter: balance,
    method: 'momo',
    provider: momoProvider || user.momoProvider || 'mtn',
    accountNumber: target,
    accountName: user.fullName,
    status: 'processing',
    description: 'Wallet withdrawal to mobile money',
  });

  await user.update({ walletBalance: balance, momoNumber: target, momoProvider: momoProvider || user.momoProvider });

  const { sendSms } = require('../services/smsService');
  await sendSms({
    to: user.phone, userId: user.id, template: 'payoutSent',
    data: { amount: value - fee, reference: tx.reference, momoNumber: target },
    type: 'payment', force: true,
  });

  return ok(res, tx, `GHS ${(value - fee).toFixed(2)} is on its way to ${target}`);
});

/** GET /users/me/reviews */
exports.myReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.findAll({
    where: { revieweeId: req.user.id, isPublished: true },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'avatarUrl', 'role'] },
      { model: Order, as: 'order', attributes: ['id', 'code'] },
    ],
    order: [['createdAt', 'DESC']],
  });
  return ok(res, reviews);
});
