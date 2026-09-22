const {
  User, Listing, Order, MarketPrice, Region, Produce, Category,
  UssdSession, SmsMessage, Market, Op, sequelize,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { daysAgo } = require('../utils/helpers');

/**
 * GET /stats/public — the counters on the landing page. Cached for a minute
 * because the homepage is the most-hit route on the platform.
 */
let cache = { at: 0, data: null };

exports.publicStats = asyncHandler(async (_req, res) => {
  if (cache.data && Date.now() - cache.at < 60 * 1000) return ok(res, cache.data);

  const [farmers, buyers, listings, activeListings, orders, markets, regions, produce] = await Promise.all([
    User.count({ where: { role: 'farmer', status: 'active' } }),
    User.count({ where: { role: 'buyer', status: 'active' } }),
    Listing.count(),
    Listing.count({ where: { status: 'active' } }),
    Order.count({ where: { status: 'completed' } }),
    Market.count({ where: { isActive: true } }),
    Region.count({ where: { isActive: true } }),
    Produce.count({ where: { isActive: true } }),
  ]);

  const [tradeValue, ussdSessions, smsSent] = await Promise.all([
    Order.sum('totalAmount', { where: { status: 'completed' } }),
    UssdSession.count({ where: { isSimulated: false } }),
    SmsMessage.count({ where: { direction: 'outbound', status: ['sent', 'delivered'] } }),
  ]);

  const data = {
    farmers,
    buyers,
    users: farmers + buyers,
    listings,
    activeListings,
    completedOrders: orders,
    tradeValue: Number(tradeValue || 0),
    markets,
    regions,
    produceTypes: produce,
    ussdSessions,
    smsSent,
  };

  cache = { at: Date.now(), data };
  return ok(res, data);
});

/** GET /stats/market-snapshot — the "today at a glance" strip on the homepage. */
exports.marketSnapshot = asyncHandler(async (_req, res) => {
  const topMovers = await MarketPrice.findAll({
    where: { isPublished: true, priceDate: { [Op.gte]: daysAgo(7).toISOString().slice(0, 10) } },
    include: [
      { model: Produce, as: 'produce', attributes: ['id', 'name', 'slug', 'imageUrl'] },
      { model: Market, as: 'market', attributes: ['id', 'name'] },
    ],
    order: [[sequelize.fn('ABS', sequelize.col('changePercent')), 'DESC']],
    limit: 6,
  });

  const busiestRegions = await Listing.findAll({
    where: { status: 'active' },
    attributes: ['regionId', [sequelize.fn('COUNT', sequelize.col('Listing.id')), 'count']],
    include: [{ model: Region, as: 'region', attributes: ['id', 'name'] }],
    group: ['regionId', 'region.id', 'region.name'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 5,
  });

  const topCategories = await Listing.findAll({
    where: { status: 'active' },
    attributes: ['categoryId', [sequelize.fn('COUNT', sequelize.col('Listing.id')), 'count']],
    include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'color', 'icon'] }],
    group: ['categoryId', 'category.id', 'category.name', 'category.slug', 'category.color', 'category.icon'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 6,
  });

  return ok(res, {
    topMovers: topMovers.map((p) => ({
      produce: p.produce,
      market: p.market?.name,
      avgPrice: Number(p.avgPrice),
      unit: p.unit,
      changePercent: Number(p.changePercent),
      trend: p.trend,
    })),
    busiestRegions: busiestRegions.map((r) => ({
      region: r.region?.name,
      regionId: r.regionId,
      listings: Number(r.get('count')),
    })),
    topCategories: topCategories.map((c) => ({
      category: c.category,
      listings: Number(c.get('count')),
    })),
  });
});
