const {
  User, Listing, Order, Offer, MarketPrice, Produce, Category, Region, District,
  Market, SmsMessage, UssdSession, Transaction, AuditLog, Setting, SupportTicket,
  ImpactRecord, Review, Op, sequelize,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate, daysAgo, normalizePhone, generateOtp } = require('../utils/helpers');
const listingService = require('../services/listingService');
const orderService = require('../services/orderService');
const auditService = require('../services/auditService');
const staffPolicy = require('../services/staffPolicy');
const settingsService = require('../services/settingsService');
const { sendSms } = require('../services/smsService');
const { notify } = require('../services/notificationService');
const env = require('../config/env');

/* ══════════════════════════ Dashboard ═══════════════════════════════ */

/** GET /admin/dashboard */
exports.dashboard = asyncHandler(async (req, res) => {
  const days = Math.min(365, parseInt(req.query.days, 10) || 30);
  const since = daysAgo(days);
  const prevSince = daysAgo(days * 2);

  const countIn = (model, where = {}) => model.count({ where });
  const countSince = (model, from, to, where = {}) =>
    model.count({ where: { ...where, createdAt: to ? { [Op.gte]: from, [Op.lt]: to } : { [Op.gte]: from } } });

  const [
    totalUsers, totalFarmers, totalBuyers, activeListings, totalListings,
    totalOrders, pendingOrders, completedOrders, openTickets, pendingModeration,
  ] = await Promise.all([
    countIn(User, { role: { [Op.notIn]: ['admin', 'superadmin'] } }),
    countIn(User, { role: 'farmer' }),
    countIn(User, { role: 'buyer' }),
    countIn(Listing, { status: 'active' }),
    countIn(Listing),
    countIn(Order),
    countIn(Order, { status: 'pending' }),
    countIn(Order, { status: 'completed' }),
    countIn(SupportTicket, { status: ['open', 'in_progress'] }),
    countIn(Listing, { status: 'pending' }),
  ]);

  // Period-over-period growth for the KPI cards
  const [usersNow, usersPrev, ordersNow, ordersPrev, listingsNow, listingsPrev] = await Promise.all([
    countSince(User, since, null, { role: { [Op.notIn]: ['admin', 'superadmin'] } }),
    countSince(User, prevSince, since, { role: { [Op.notIn]: ['admin', 'superadmin'] } }),
    countSince(Order, since),
    countSince(Order, prevSince, since),
    countSince(Listing, since),
    countSince(Listing, prevSince, since),
  ]);

  const growth = (now, prev) => (prev > 0 ? Number((((now - prev) / prev) * 100).toFixed(1)) : now > 0 ? 100 : 0);

  const [gmv, gmvNow, gmvPrev, commission] = await Promise.all([
    Order.sum('totalAmount', { where: { status: 'completed' } }),
    Order.sum('totalAmount', { where: { status: 'completed', createdAt: { [Op.gte]: since } } }),
    Order.sum('totalAmount', { where: { status: 'completed', createdAt: { [Op.gte]: prevSince, [Op.lt]: since } } }),
    Order.sum('commission', { where: { status: 'completed' } }),
  ]);

  const [ussdSessions, ussdNow, smsSent, smsCost] = await Promise.all([
    UssdSession.count({ where: { isSimulated: false } }),
    UssdSession.count({ where: { isSimulated: false, createdAt: { [Op.gte]: since } } }),
    SmsMessage.count({ where: { direction: 'outbound' } }),
    SmsMessage.sum('cost'),
  ]);

  // Daily activity series for the dashboard chart
  const dailyOrders = await Order.findAll({
    where: { createdAt: { [Op.gte]: since } },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      [sequelize.fn('SUM', sequelize.col('totalAmount')), 'value'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    raw: true,
  });

  const dailyUsers = await User.findAll({
    where: { createdAt: { [Op.gte]: since }, role: { [Op.notIn]: ['admin', 'superadmin'] } },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'users'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    raw: true,
  });

  // Channel mix — evidence for how much of the platform runs on feature phones
  const channelMix = await Listing.findAll({
    attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['source'],
    raw: true,
  });

  const registrationMix = await User.findAll({
    where: { role: { [Op.notIn]: ['admin', 'superadmin'] } },
    attributes: ['registrationChannel', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['registrationChannel'],
    raw: true,
  });

  const topProduce = await Listing.findAll({
    where: { status: ['active', 'sold'] },
    attributes: ['produceId', [sequelize.fn('COUNT', sequelize.col('Listing.id')), 'count']],
    include: [{ model: Produce, as: 'produce', attributes: ['id', 'name', 'imageUrl'] }],
    group: ['produceId', 'produce.id', 'produce.name', 'produce.imageUrl'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 6,
  });

  const byRegion = await User.findAll({
    where: { role: 'farmer' },
    attributes: ['regionId', [sequelize.fn('COUNT', sequelize.col('User.id')), 'count']],
    include: [{ model: Region, as: 'region', attributes: ['id', 'name'] }],
    group: ['regionId', 'region.id', 'region.name'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 10,
  });

  const recentOrders = await Order.findAll({
    include: orderService.ORDER_INCLUDES,
    order: [['createdAt', 'DESC']],
    limit: 8,
  });

  const recentUsers = await User.findAll({
    where: { role: { [Op.notIn]: ['admin', 'superadmin'] } },
    attributes: ['id', 'uuid', 'fullName', 'phone', 'role', 'avatarUrl', 'registrationChannel', 'createdAt'],
    include: [{ model: Region, as: 'region', attributes: ['name'] }],
    order: [['createdAt', 'DESC']],
    limit: 8,
  });

  return ok(res, {
    period: { days, since },
    kpis: {
      users: { total: totalUsers, new: usersNow, growth: growth(usersNow, usersPrev) },
      farmers: totalFarmers,
      buyers: totalBuyers,
      listings: { total: totalListings, active: activeListings, new: listingsNow, growth: growth(listingsNow, listingsPrev) },
      orders: { total: totalOrders, pending: pendingOrders, completed: completedOrders, new: ordersNow, growth: growth(ordersNow, ordersPrev) },
      gmv: { total: Number(gmv || 0), period: Number(gmvNow || 0), growth: growth(Number(gmvNow || 0), Number(gmvPrev || 0)) },
      commission: Number(commission || 0),
      ussd: { total: ussdSessions, period: ussdNow },
      sms: { sent: smsSent, cost: Number(Number(smsCost || 0).toFixed(2)) },
      attention: { openTickets, pendingModeration },
    },
    charts: {
      dailyOrders: dailyOrders.map((d) => ({ date: d.date, orders: Number(d.orders), value: Number(d.value || 0) })),
      dailyUsers: dailyUsers.map((d) => ({ date: d.date, users: Number(d.users) })),
      channelMix: channelMix.map((c) => ({ channel: c.source, count: Number(c.count) })),
      registrationMix: registrationMix.map((c) => ({ channel: c.registrationChannel, count: Number(c.count) })),
      topProduce: topProduce.map((p) => ({ produce: p.produce, count: Number(p.get('count')) })),
      byRegion: byRegion.map((r) => ({ region: r.region?.name || 'Unassigned', count: Number(r.get('count')) })),
    },
    recentOrders,
    recentUsers,
  });
});

/* ══════════════════════════ Users ═══════════════════════════════════ */

/** GET /admin/users */
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};

  if (req.query.role) where.role = req.query.role;
  else where.role = { [Op.notIn]: ['admin', 'superadmin'] };

  if (req.query.status) where.status = req.query.status;
  if (req.query.regionId) where.regionId = req.query.regionId;
  if (req.query.channel) where.registrationChannel = req.query.channel;
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    where[Op.or] = [
      { fullName: { [Op.like]: term } },
      { phone: { [Op.like]: `%${normalizePhone(req.query.search) || req.query.search}%` } },
      { email: { [Op.like]: term } },
      { businessName: { [Op.like]: term } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    include: [
      { model: Region, as: 'region', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
    ],
    order: [[req.query.sortBy || 'createdAt', req.query.sortDir === 'asc' ? 'ASC' : 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /admin/users/:id */
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    include: [
      { model: Region, as: 'region', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
    ],
  });
  if (!user) throw ApiError.notFound('User not found');

  const [listings, orders, sessions, messages, transactions, reviews] = await Promise.all([
    Listing.findAll({
      where: { farmerId: user.id },
      include: [{ model: Produce, as: 'produce', attributes: ['name', 'imageUrl'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    Order.findAll({
      where: { [Op.or]: [{ buyerId: user.id }, { farmerId: user.id }] },
      include: orderService.ORDER_INCLUDES,
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    UssdSession.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 10 }),
    SmsMessage.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 10 }),
    Transaction.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 10 }),
    Review.findAll({
      where: { revieweeId: user.id },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName'] }],
      limit: 10,
    }),
  ]);

  const stats = {
    listings: await Listing.count({ where: { farmerId: user.id } }),
    activeListings: await Listing.count({ where: { farmerId: user.id, status: 'active' } }),
    orders: await Order.count({ where: { [Op.or]: [{ buyerId: user.id }, { farmerId: user.id }] } }),
    completedOrders: await Order.count({
      where: { [Op.or]: [{ buyerId: user.id }, { farmerId: user.id }], status: 'completed' },
    }),
    ussdSessions: await UssdSession.count({ where: { userId: user.id } }),
    smsReceived: await SmsMessage.count({ where: { userId: user.id, direction: 'outbound' } }),
    revenue: Number((await Order.sum('farmerPayout', { where: { farmerId: user.id, status: 'completed' } })) || 0),
    spend: Number((await Order.sum('totalAmount', { where: { buyerId: user.id, status: 'completed' } })) || 0),
  };

  return ok(res, { user, stats, listings, orders, sessions, messages, transactions, reviews });
});

/** PATCH /admin/users/:id */
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const editable = [
    'fullName', 'email', 'phone', 'role', 'status', 'regionId', 'districtId',
    'community', 'isVerifiedSeller', 'isPhoneVerified', 'suspendedReason',
    'businessName', 'businessType', 'permissions', 'smsNotifications',
  ];
  const patch = {};
  editable.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

  // Administrator accounts (and promotions to one) follow the Admin team rules,
  // so this general endpoint can't be used to get around them
  await staffPolicy.assertStaffChange(req.user, user, patch);
  if (patch.phone) patch.phone = normalizePhone(patch.phone);

  const before = user.toJSON();
  await user.update(patch);

  const { oldValue, newValue, changed } = auditService.diff(before, user.toJSON(), Object.keys(patch));
  if (changed) {
    await auditService.record(req, {
      action: 'user.update',
      entity: 'user',
      entityId: user.id,
      description: `Updated ${user.fullName}`,
      oldValue,
      newValue,
      severity: patch.status || patch.role ? 'warning' : 'info',
    });
  }

  // Tell the person their account state changed
  if (patch.status === 'suspended') {
    await sendSms({
      to: user.phone, userId: user.id, template: 'accountSuspended',
      data: { reason: patch.suspendedReason || 'Policy violation' }, type: 'system', force: true,
    });
  } else if (patch.status === 'active' && before.status === 'suspended') {
    await sendSms({
      to: user.phone, userId: user.id,
      template: 'accountReactivated',
      type: 'system', force: true,
    });
  }
  if (patch.isVerifiedSeller && !before.isVerifiedSeller) {
    await notify({
      userId: user.id,
      title: 'You are now a verified seller',
      message: 'Your account has been verified. Buyers will see a verified badge on your listings.',
      type: 'account', icon: 'BadgeCheck', link: '/dashboard/profile',
    });
  }

  return ok(res, user, 'User updated');
});

/** POST /admin/users — staff creates an account (field registrations, admins). */
exports.createUser = asyncHandler(async (req, res) => {
  const { fullName, phone, email, role = 'farmer', password, regionId, districtId, community } = req.body;

  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    throw ApiError.forbidden('Only a super administrator can appoint another super administrator');
  }

  const normalized = normalizePhone(phone);
  const existing = await User.findOne({ where: { phone: normalized }, paranoid: false });
  if (existing) throw ApiError.conflict('That phone number already has an account');

  const tempPassword = password || `Agri${generateOtp(4)}!`;
  const user = await User.create({
    fullName,
    phone: normalized,
    email: email || null,
    password: tempPassword,
    role,
    regionId: regionId || null,
    districtId: districtId || null,
    community: community || null,
    registrationChannel: 'agent',
    status: 'active',
    isPhoneVerified: true,
  });

  await auditService.record(req, {
    action: 'user.create', entity: 'user', entityId: user.id,
    description: `Created ${role} account for ${fullName}`, severity: 'warning',
  });

  if (!['admin', 'superadmin'].includes(role)) {
    await sendSms({
      to: user.phone, userId: user.id,
      message: `AgriMart: An account has been created for you. Dial ${env.ussd.serviceCode} to set your PIN and start trading. Web password: ${tempPassword}`,
      type: 'welcome', force: true,
    });
  }

  return created(res, { user, temporaryPassword: password ? undefined : tempPassword }, 'Account created');
});

/** DELETE /admin/users/:id */
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');
  if (staffPolicy.isStaffRole(user.role)) await staffPolicy.assertStaffRemoval(req.user, user);

  const openOrders = await Order.count({
    where: {
      [Op.or]: [{ buyerId: user.id }, { farmerId: user.id }],
      status: ['pending', 'accepted', 'paid', 'in_transit'],
    },
  });
  if (openOrders) throw ApiError.badRequest(`${openOrders} open order(s) must be settled before deleting this account`);

  // Take their trade off the marketplace so nothing dangles behind them
  const [listings] = await Listing.update(
    { status: 'withdrawn' },
    { where: { farmerId: user.id, status: ['active', 'pending', 'reserved'] } }
  );
  const [offers] = await Offer.update(
    { status: 'withdrawn', respondedAt: new Date() },
    { where: { buyerId: user.id, status: ['pending', 'countered'] } }
  );

  await user.destroy();
  await auditService.record(req, {
    action: 'user.delete', entity: 'user', entityId: req.params.id,
    description: `Deleted account ${user.fullName} (${user.phone})`
      + `${listings ? `, withdrew ${listings} listing(s)` : ''}${offers ? `, cancelled ${offers} offer(s)` : ''}`,
    severity: 'critical',
  });

  const tidied = [
    listings ? `${listings} listing${listings > 1 ? 's' : ''} withdrawn` : null,
    offers ? `${offers} offer${offers > 1 ? 's' : ''} cancelled` : null,
  ].filter(Boolean);

  return ok(res, { listings, offers }, `Account deleted${tidied.length ? ` — ${tidied.join(' and ')}` : ''}`);
});

/* ══════════════════════ Listing moderation ══════════════════════════ */

/** GET /admin/listings */
exports.listListings = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const { where, order } = listingService.buildListingQuery({ ...req.query, status: req.query.status || undefined });
  if (!req.query.status) delete where.status;

  const { rows, count } = await Listing.findAndCountAll({
    where,
    include: listingService.LISTING_INCLUDES,
    order,
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** PATCH /admin/listings/:id/moderate */
exports.moderateListing = asyncHandler(async (req, res) => {
  const { action, reason, isFeatured } = req.body;
  const listing = await Listing.findByPk(req.params.id, {
    include: [{ model: Produce, as: 'produce' }, { model: User, as: 'farmer' }],
  });
  if (!listing) throw ApiError.notFound('Listing not found');

  if (action === 'feature') {
    await listing.update({ isFeatured: isFeatured !== false });
    return ok(res, listing, listing.isFeatured ? 'Listing featured' : 'Listing unfeatured');
  }

  const map = { approve: 'active', reject: 'rejected', suspend: 'withdrawn' };
  const status = map[action];
  if (!status) throw ApiError.badRequest('Use approve, reject, suspend or feature');
  if (status === 'rejected' && !reason) throw ApiError.badRequest('Give the farmer a reason for the rejection');

  await listing.update({
    status,
    moderatedBy: req.user.id,
    moderatedAt: new Date(),
    rejectionReason: reason || null,
  });

  await sendSms({
    to: listing.farmer.phone,
    userId: listing.farmerId,
    template: status === 'active' ? 'listingApproved' : 'listingRejected',
    data: { code: listing.code, produce: listing.produce.name, reason: reason || 'Does not meet our listing guidelines' },
    type: 'listing',
    relatedType: 'listing',
    relatedId: listing.id,
  });

  await notify({
    userId: listing.farmerId,
    title: status === 'active' ? `Listing ${listing.code} approved` : `Listing ${listing.code} ${status}`,
    message: status === 'active'
      ? 'Your listing is live and visible to buyers nationwide.'
      : `Reason: ${reason || 'Does not meet our listing guidelines'}`,
    type: 'listing',
    icon: status === 'active' ? 'CheckCircle2' : 'AlertTriangle',
    link: '/dashboard/listings',
  });

  await auditService.record(req, {
    action: `listing.${action}`,
    entity: 'listing',
    entityId: listing.id,
    description: `${action} listing ${listing.code}`,
    severity: action === 'approve' ? 'info' : 'warning',
  });

  return ok(res, listing, `Listing ${action}d`);
});

/* ══════════════════════════ Orders ══════════════════════════════════ */

/** GET /admin/orders */
exports.listOrders = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.source) where.source = req.query.source;
  if (req.query.search) where.code = { [Op.like]: `%${req.query.search}%` };
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
    if (req.query.to) where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59`);
  }

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

/* ══════════════════════ Analytics & impact ══════════════════════════ */

/**
 * GET /admin/analytics — objective 5. Measures whether farmers on the platform
 * are actually reaching more buyers and earning more, not just whether the
 * software works.
 */
exports.analytics = asyncHandler(async (req, res) => {
  const days = Math.min(730, parseInt(req.query.days, 10) || 90);
  const since = daysAgo(days);

  // Market participation: how many registered farmers actually traded
  const [registeredFarmers, farmersWithListings, farmersWithSales] = await Promise.all([
    User.count({ where: { role: 'farmer' } }),
    Listing.count({ where: {}, distinct: true, col: 'farmerId' }),
    Order.count({ where: { status: 'completed' }, distinct: true, col: 'farmerId' }),
  ]);

  // Income: average value a selling farmer has earned through the platform
  const farmerEarnings = await Order.findAll({
    where: { status: 'completed' },
    attributes: [
      'farmerId',
      [sequelize.fn('SUM', sequelize.col('farmerPayout')), 'earned'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'sales'],
    ],
    group: ['farmerId'],
    raw: true,
  });

  const totalEarned = farmerEarnings.reduce((sum, f) => sum + Number(f.earned || 0), 0);
  const avgEarnings = farmerEarnings.length ? totalEarned / farmerEarnings.length : 0;

  // Price spread captured: how much more than the lowest market price farmers got
  const priceSpread = await MarketPrice.findAll({
    attributes: [
      'produceId',
      [sequelize.fn('MIN', sequelize.col('avgPrice')), 'lowest'],
      [sequelize.fn('MAX', sequelize.col('avgPrice')), 'highest'],
      [sequelize.fn('AVG', sequelize.col('avgPrice')), 'average'],
    ],
    include: [{ model: Produce, as: 'produce', attributes: ['id', 'name'] }],
    where: { priceDate: { [Op.gte]: since.toISOString().slice(0, 10) } },
    group: ['produceId', 'produce.id', 'produce.name'],
    having: sequelize.literal('COUNT(MarketPrice.id) > 1'),
    limit: 12,
  });

  // Channel reach — the core claim of the study: USSD lets offline farmers trade
  const [ussdListings, webListings, smsListings] = await Promise.all([
    Listing.count({ where: { source: 'ussd' } }),
    Listing.count({ where: { source: 'web' } }),
    Listing.count({ where: { source: 'sms' } }),
  ]);

  const [ussdRegistrations, webRegistrations] = await Promise.all([
    User.count({ where: { registrationChannel: 'ussd' } }),
    User.count({ where: { registrationChannel: 'web' } }),
  ]);

  // Self-reported survey data
  const impact = await ImpactRecord.findAll({
    attributes: [
      [sequelize.fn('AVG', sequelize.col('monthlyIncomeBefore')), 'incomeBefore'],
      [sequelize.fn('AVG', sequelize.col('monthlyIncomeAfter')), 'incomeAfter'],
      [sequelize.fn('AVG', sequelize.col('buyersReachedBefore')), 'buyersBefore'],
      [sequelize.fn('AVG', sequelize.col('buyersReachedAfter')), 'buyersAfter'],
      [sequelize.fn('AVG', sequelize.col('postHarvestLossBefore')), 'lossBefore'],
      [sequelize.fn('AVG', sequelize.col('postHarvestLossAfter')), 'lossAfter'],
      [sequelize.fn('AVG', sequelize.col('satisfactionScore')), 'satisfaction'],
      [sequelize.fn('SUM', sequelize.col('travelCostSaved')), 'travelSaved'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'responses'],
    ],
    raw: true,
  });
  const survey = impact[0] || {};

  const monthlyGmv = await Order.findAll({
    where: { status: 'completed', createdAt: { [Op.gte]: since } },
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'month'],
      [sequelize.fn('SUM', sequelize.col('totalAmount')), 'gmv'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('farmerId'))), 'sellers'],
    ],
    group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')],
    order: [[sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
    raw: true,
  });

  const regionParticipation = await Order.findAll({
    where: { status: 'completed' },
    attributes: [[sequelize.fn('COUNT', sequelize.col('Order.id')), 'orders']],
    include: [{
      model: Listing, as: 'listing', attributes: ['regionId'],
      include: [{ model: Region, as: 'region', attributes: ['name'] }],
    }],
    group: ['listing.regionId', 'listing.id', 'listing->region.id', 'listing->region.name'],
    limit: 200,
    raw: true,
    nest: true,
  });

  const regionTotals = {};
  regionParticipation.forEach((r) => {
    const name = r.listing?.region?.name || 'Unassigned';
    regionTotals[name] = (regionTotals[name] || 0) + Number(r.orders || 0);
  });

  return ok(res, {
    period: { days, since },
    participation: {
      registeredFarmers,
      farmersWithListings,
      farmersWithSales,
      listingRate: registeredFarmers ? Number(((farmersWithListings / registeredFarmers) * 100).toFixed(1)) : 0,
      saleRate: registeredFarmers ? Number(((farmersWithSales / registeredFarmers) * 100).toFixed(1)) : 0,
    },
    income: {
      totalPaidToFarmers: Number(totalEarned.toFixed(2)),
      averagePerSellingFarmer: Number(avgEarnings.toFixed(2)),
      sellingFarmers: farmerEarnings.length,
      topEarners: farmerEarnings
        .sort((a, b) => Number(b.earned) - Number(a.earned))
        .slice(0, 10)
        .map((f) => ({ farmerId: f.farmerId, earned: Number(f.earned), sales: Number(f.sales) })),
    },
    priceTransparency: priceSpread.map((p) => ({
      produce: p.produce?.name,
      lowest: Number(p.get('lowest')),
      highest: Number(p.get('highest')),
      average: Number(Number(p.get('average')).toFixed(2)),
      spread: Number((Number(p.get('highest')) - Number(p.get('lowest'))).toFixed(2)),
      spreadPercent: Number((((Number(p.get('highest')) - Number(p.get('lowest'))) / Number(p.get('lowest'))) * 100).toFixed(1)),
    })),
    channelReach: {
      listings: { ussd: ussdListings, web: webListings, sms: smsListings },
      registrations: { ussd: ussdRegistrations, web: webRegistrations },
      offlineShare: (ussdListings + smsListings + webListings)
        ? Number((((ussdListings + smsListings) / (ussdListings + smsListings + webListings)) * 100).toFixed(1))
        : 0,
    },
    survey: {
      responses: Number(survey.responses || 0),
      incomeBefore: Number(Number(survey.incomeBefore || 0).toFixed(2)),
      incomeAfter: Number(Number(survey.incomeAfter || 0).toFixed(2)),
      incomeChangePercent: survey.incomeBefore
        ? Number((((survey.incomeAfter - survey.incomeBefore) / survey.incomeBefore) * 100).toFixed(1))
        : 0,
      buyersBefore: Number(Number(survey.buyersBefore || 0).toFixed(1)),
      buyersAfter: Number(Number(survey.buyersAfter || 0).toFixed(1)),
      lossBefore: Number(Number(survey.lossBefore || 0).toFixed(1)),
      lossAfter: Number(Number(survey.lossAfter || 0).toFixed(1)),
      satisfaction: Number(Number(survey.satisfaction || 0).toFixed(2)),
      travelCostSaved: Number(Number(survey.travelSaved || 0).toFixed(2)),
    },
    monthlyGmv: monthlyGmv.map((m) => ({
      month: m.month,
      gmv: Number(m.gmv || 0),
      orders: Number(m.orders),
      sellers: Number(m.sellers),
    })),
    regionParticipation: Object.entries(regionTotals)
      .map(([region, orders]) => ({ region, orders }))
      .sort((a, b) => b.orders - a.orders),
  });
});

/** GET /admin/impact — the raw survey rows behind the analytics page. */
exports.listImpact = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};
  if (req.query.surveyType) where.surveyType = req.query.surveyType;
  if (req.query.period) where.period = req.query.period;

  const { rows, count } = await ImpactRecord.findAndCountAll({
    where,
    include: [{
      model: User, as: 'farmer',
      attributes: ['id', 'fullName', 'phone', 'regionId'],
      include: [{ model: Region, as: 'region', attributes: ['name'] }],
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** POST /admin/impact */
exports.createImpact = asyncHandler(async (req, res) => {
  const record = await ImpactRecord.create({ ...req.body, collectedBy: req.user.id });
  await auditService.record(req, {
    action: 'impact.create', entity: 'impact_record', entityId: record.id,
    description: `Recorded ${record.surveyType} survey for farmer #${record.userId}`,
  });
  return created(res, record, 'Survey response saved');
});

/* ══════════════════════ Audit & settings ════════════════════════════ */

/** GET /admin/audit-logs */
exports.auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 30 });
  const where = {};
  if (req.query.action) where.action = { [Op.like]: `%${req.query.action}%` };
  if (req.query.entity) where.entity = req.query.entity;
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.userId) where.userId = req.query.userId;

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'avatarUrl', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /admin/settings */
exports.getSettings = asyncHandler(async (req, res) => {
  const where = req.query.group ? { group: req.query.group } : {};
  const rows = await Setting.findAll({ where, order: [['group', 'ASC'], ['key', 'ASC']] });
  return ok(res, rows);
});

/** PATCH /admin/settings */
exports.updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body.settings || [];
  if (!Array.isArray(updates)) throw ApiError.badRequest('Send a settings array');

  const changed = [];
  for (const { key, value } of updates) {
    const setting = await Setting.findOne({ where: { key } });
    if (!setting || !setting.isEditable) continue;

    const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '').trim();
    if (setting.type === 'number' && (text === '' || !Number.isFinite(Number(text)))) {
      throw ApiError.badRequest(`"${setting.label || key}" must be a number`);
    }
    if (setting.type === 'boolean' && !['true', 'false'].includes(text)) {
      throw ApiError.badRequest(`"${setting.label || key}" must be on or off`);
    }
    if (setting.value === text) continue;

    const before = setting.value;
    await setting.update({ value: text });
    changed.push({ key, from: before, to: setting.value });
  }

  // Apply at once: SMS wording, USSD screens and the website read these live
  if (changed.length) await settingsService.refresh();

  await auditService.record(req, {
    action: 'settings.update',
    entity: 'setting',
    description: `Updated ${changed.length} setting(s)`,
    newValue: changed,
    severity: 'warning',
  });

  return ok(res, changed, `${changed.length} setting(s) updated`);
});

/** GET /settings/public — contact details, codes and switches the website shows. */
exports.publicSettings = asyncHandler(async (_req, res) => {
  if (!settingsService.isLoaded()) await settingsService.load();
  return ok(res, settingsService.publicSettings());
});

/** GET /admin/transactions */
exports.listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};
  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where.reference = { [Op.like]: `%${req.query.search}%` };

  const { rows, count } = await Transaction.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'role'] },
      { model: Order, as: 'order', attributes: ['id', 'code'] },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  const [inflow, outflow, commission] = await Promise.all([
    Transaction.sum('amount', { where: { direction: 'credit', status: 'success' } }),
    Transaction.sum('amount', { where: { direction: 'debit', status: 'success' } }),
    Order.sum('commission', { where: { status: 'completed' } }),
  ]);

  return paginated(
    res, rows, { page, limit, total: count },
    JSON.stringify({ inflow: Number(inflow || 0), outflow: Number(outflow || 0), commission: Number(commission || 0) })
  );
});

/** PATCH /admin/transactions/:id — settle or fail a pending payout. */
exports.updateTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findByPk(req.params.id);
  if (!tx) throw ApiError.notFound('Transaction not found');

  const { status, failureReason } = req.body;
  if (!['success', 'failed', 'reversed'].includes(status)) {
    throw ApiError.badRequest('Set the status to success, failed or reversed');
  }

  await tx.update({ status, failureReason: failureReason || null, processedAt: new Date() });

  // A failed or reversed withdrawal puts the money back in the wallet
  if (['failed', 'reversed'].includes(status) && tx.direction === 'debit') {
    const user = await User.findByPk(tx.userId);
    if (user) await user.update({ walletBalance: Number(user.walletBalance) + Number(tx.amount) });
  }

  await auditService.record(req, {
    action: 'transaction.update', entity: 'transaction', entityId: tx.id,
    description: `Marked ${tx.reference} as ${status}`, severity: 'warning',
  });

  return ok(res, tx, `Transaction marked ${status}`);
});
