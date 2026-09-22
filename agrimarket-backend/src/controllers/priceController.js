const { MarketPrice, Produce, Market, Region, PriceAlert, Category, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const priceService = require('../services/priceService');
const auditService = require('../services/auditService');
const { sendSms } = require('../services/smsService');

/** GET /prices — latest observation per produce/market, the public price board. */
exports.latest = asyncHandler(async (req, res) => {
  const rows = await priceService.latestPrices({
    produceId: req.query.produceId,
    marketId: req.query.marketId,
    regionId: req.query.regionId,
    categoryId: req.query.categoryId,
    priceType: req.query.priceType,
    limit: Math.min(500, parseInt(req.query.limit, 10) || 120),
  });
  return ok(res, rows);
});

/** GET /prices/national — headline averages used on the landing and prices pages. */
exports.national = asyncHandler(async (req, res) => {
  const rows = await priceService.nationalAverages({
    limit: parseInt(req.query.limit, 10) || 20,
    categoryId: req.query.categoryId,
  });
  return ok(res, rows);
});

/** GET /prices/history/:produceId — series for the trend chart. */
exports.history = asyncHandler(async (req, res) => {
  const produce = await Produce.findByPk(req.params.produceId);
  if (!produce) throw ApiError.notFound('Produce not found');

  const rows = await priceService.priceHistory(req.params.produceId, {
    marketId: req.query.marketId,
    days: Math.min(365, parseInt(req.query.days, 10) || 90),
    unit: req.query.unit,
  });

  /*
   * A single market reports on its own dates, so it charts daily. The national
   * view combines markets that record on different days; bucketing by day would
   * mix a different subset of markets into every point and make the line jump for
   * reasons that have nothing to do with price. Weekly buckets compare like with like.
   */
  const singleMarket = Boolean(req.query.marketId);
  const weekStart = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
    return d.toISOString().slice(0, 10);
  };

  const buckets = new Map();
  rows.forEach((r) => {
    const key = singleMarket ? r.priceDate : weekStart(r.priceDate);
    if (!buckets.has(key)) buckets.set(key, { date: key, values: [], lows: [], highs: [] });
    const entry = buckets.get(key);
    const avg = Number(r.avgPrice);
    entry.values.push(avg);
    // one market: the day's observed range; national: cheapest to dearest market that week
    entry.lows.push(singleMarket ? Number(r.minPrice) : avg);
    entry.highs.push(singleMarket ? Number(r.maxPrice) : avg);
  });

  const series = [...buckets.values()]
    .map((e) => ({
      date: e.date,
      avgPrice: Number((e.values.reduce((a, b) => a + b, 0) / e.values.length).toFixed(2)),
      minPrice: Math.min(...e.lows),
      maxPrice: Math.max(...e.highs),
      observations: e.values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return ok(res, { produce, series, bucket: singleMarket ? 'day' : 'week' });
});

/** GET /prices/compare?produceId=&marketIds= — market-by-market comparison. */
exports.compare = asyncHandler(async (req, res) => {
  const { produceId } = req.query;
  if (!produceId) throw ApiError.badRequest('Select a produce to compare');

  const rows = await priceService.latestPrices({ produceId, limit: 100 });
  const sorted = rows
    .map((r) => ({
      marketId: r.marketId,
      market: r.market?.name,
      region: r.region?.name,
      unit: r.unit,
      avgPrice: Number(r.avgPrice),
      minPrice: Number(r.minPrice),
      maxPrice: Number(r.maxPrice),
      changePercent: Number(r.changePercent),
      trend: r.trend,
      priceDate: r.priceDate,
    }))
    .sort((a, b) => b.avgPrice - a.avgPrice);

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const spread = best && worst ? Number((best.avgPrice - worst.avgPrice).toFixed(2)) : 0;

  return ok(res, {
    markets: sorted,
    best,
    worst,
    spread,
    spreadPercent: worst?.avgPrice ? Number(((spread / worst.avgPrice) * 100).toFixed(1)) : 0,
  });
});

/** POST /prices — admins and field agents record an observation. */
exports.create = asyncHandler(async (req, res) => {
  const price = await priceService.recordPrice(req.body, req.user.id);
  await auditService.record(req, {
    action: 'price.create',
    entity: 'market_price',
    entityId: price.id,
    description: `Recorded ${price.produce?.name} at ${price.market?.name}: GHS ${price.avgPrice}/${price.unit}`,
  });
  return created(res, price, 'Price recorded and alerts have been checked');
});

/** POST /prices/bulk — a market day upload of many observations at once. */
exports.bulkCreate = asyncHandler(async (req, res) => {
  const { prices } = req.body;
  if (!Array.isArray(prices) || !prices.length) throw ApiError.badRequest('Send an array of prices');

  const results = { created: 0, failed: 0, errors: [] };
  for (const row of prices) {
    try {
      await priceService.recordPrice(row, req.user.id);
      results.created += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ row, error: err.message });
    }
  }

  await auditService.record(req, {
    action: 'price.bulk_create',
    entity: 'market_price',
    description: `Bulk price upload: ${results.created} recorded, ${results.failed} failed`,
  });

  return created(res, results, `${results.created} price(s) recorded`);
});

/** GET /prices/admin — full table with paging for the admin price manager. */
exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};
  if (req.query.produceId) where.produceId = req.query.produceId;
  if (req.query.marketId) where.marketId = req.query.marketId;
  if (req.query.source) where.source = req.query.source;
  if (req.query.from || req.query.to) {
    where.priceDate = {};
    if (req.query.from) where.priceDate[Op.gte] = req.query.from;
    if (req.query.to) where.priceDate[Op.lte] = req.query.to;
  }

  const { rows, count } = await MarketPrice.findAndCountAll({
    where,
    include: priceService.PRICE_INCLUDES,
    order: [['priceDate', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** PATCH /prices/:id */
exports.update = asyncHandler(async (req, res) => {
  const price = await MarketPrice.findByPk(req.params.id);
  if (!price) throw ApiError.notFound('Price record not found');

  const before = price.toJSON();
  await price.update(req.body);

  await auditService.record(req, {
    action: 'price.update',
    entity: 'market_price',
    entityId: price.id,
    description: `Updated price record #${price.id}`,
    oldValue: { avgPrice: before.avgPrice },
    newValue: { avgPrice: price.avgPrice },
  });

  return ok(res, await MarketPrice.findByPk(price.id, { include: priceService.PRICE_INCLUDES }), 'Price updated');
});

/** DELETE /prices/:id */
exports.remove = asyncHandler(async (req, res) => {
  const price = await MarketPrice.findByPk(req.params.id);
  if (!price) throw ApiError.notFound('Price record not found');
  await price.destroy();
  await auditService.record(req, {
    action: 'price.delete', entity: 'market_price', entityId: req.params.id,
    description: `Deleted price record #${req.params.id}`, severity: 'warning',
  });
  return ok(res, null, 'Price record deleted');
});

/* ── Price alerts ─────────────────────────────────────────────────────── */

exports.listAlerts = asyncHandler(async (req, res) => {
  const alerts = await PriceAlert.findAll({
    where: { userId: req.user.id },
    include: [
      { model: Produce, as: 'produce', attributes: ['id', 'name', 'imageUrl', 'defaultUnit'] },
      { model: Market, as: 'market', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  });
  return ok(res, alerts);
});

exports.createAlert = asyncHandler(async (req, res) => {
  const { produceId, targetPrice, direction = 'above', marketId, unit, channel } = req.body;

  const produce = await Produce.findByPk(produceId);
  if (!produce) throw ApiError.badRequest('Select a valid produce');

  const existing = await PriceAlert.findOne({
    where: { userId: req.user.id, produceId, direction, isActive: true, marketId: marketId || null },
  });
  if (existing) throw ApiError.conflict('You already have a similar alert on this produce');

  const alert = await PriceAlert.create({
    userId: req.user.id,
    produceId,
    marketId: marketId || null,
    regionId: req.user.regionId,
    targetPrice,
    unit: unit || produce.defaultUnit,
    direction,
    channel: channel || 'both',
    source: 'web',
  });

  return created(res, alert, `We will alert you when ${produce.name} goes ${direction} GHS ${targetPrice}`);
});

exports.deleteAlert = asyncHandler(async (req, res) => {
  const alert = await PriceAlert.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!alert) throw ApiError.notFound('Alert not found');
  await alert.destroy();
  return ok(res, null, 'Price alert removed');
});

/** POST /prices/digest/send — SMS today's prices to the signed-in user. */
exports.sendDigest = asyncHandler(async (req, res) => {
  const digest = await priceService.buildPriceDigest({
    regionId: req.body.regionId || req.user.regionId,
    marketId: req.body.marketId,
    produceIds: req.body.produceIds,
    limit: 6,
  });

  if (!digest.lines.length) throw ApiError.badRequest('There is no price data to send yet');

  await sendSms({
    to: req.user.phone,
    userId: req.user.id,
    template: 'priceDigest',
    data: digest,
    type: 'price_digest',
  });

  return ok(res, digest, `Today's prices have been sent to ${req.user.phone}`);
});
