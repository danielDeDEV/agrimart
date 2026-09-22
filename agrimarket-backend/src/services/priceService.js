const { MarketPrice, Produce, Market, Region, PriceAlert, User, Op, sequelize } = require('../models');
const { sendSms } = require('./smsService');
const { notify } = require('./notificationService');
const logger = require('../utils/logger');

const PRICE_INCLUDES = [
  { model: Produce, as: 'produce', attributes: ['id', 'name', 'slug', 'imageUrl', 'defaultUnit'] },
  { model: Market, as: 'market', attributes: ['id', 'name', 'type', 'regionId'] },
  { model: Region, as: 'region', attributes: ['id', 'name'] },
];

/**
 * Records a price and links it to the previous observation so the movement
 * arrow farmers see (up/down/stable) is computed from real history, not guessed.
 */
async function recordPrice(payload, recordedBy = null) {
  const previous = await MarketPrice.findOne({
    where: {
      produceId: payload.produceId,
      marketId: payload.marketId,
      unit: payload.unit || 'bag',
      priceType: payload.priceType || 'wholesale',
    },
    order: [['priceDate', 'DESC'], ['createdAt', 'DESC']],
  });

  const market = await Market.findByPk(payload.marketId);

  const price = await MarketPrice.create({
    produceId: payload.produceId,
    marketId: payload.marketId,
    regionId: payload.regionId || market?.regionId,
    unit: payload.unit || 'bag',
    minPrice: payload.minPrice,
    maxPrice: payload.maxPrice,
    avgPrice: payload.avgPrice || (Number(payload.minPrice) + Number(payload.maxPrice)) / 2,
    previousAvgPrice: previous ? previous.avgPrice : null,
    priceType: payload.priceType || 'wholesale',
    priceDate: payload.priceDate || new Date().toISOString().slice(0, 10),
    source: payload.source || 'admin',
    notes: payload.notes || null,
    isVerified: payload.isVerified ?? true,
    recordedBy,
  });

  await checkAlerts(price).catch((err) => logger.warn('Price alert sweep failed:', err.message));
  return MarketPrice.findByPk(price.id, { include: PRICE_INCLUDES });
}

/**
 * The latest price per produce/market pair. Written as a subquery on max(id)
 * because a plain GROUP BY on MySQL returns arbitrary non-aggregated columns.
 */
async function latestPrices({ produceId, marketId, regionId, categoryId, priceType, limit = 100 } = {}) {
  const where = { isPublished: true };
  if (produceId) where.produceId = produceId;
  if (marketId) where.marketId = marketId;
  if (regionId) where.regionId = regionId;
  if (priceType) where.priceType = priceType;

  const latestIds = await MarketPrice.findAll({
    attributes: [[sequelize.fn('MAX', sequelize.col('id')), 'id']],
    where,
    group: ['produceId', 'marketId', 'unit', 'priceType'],
    raw: true,
  });

  const ids = latestIds.map((r) => r.id);
  if (!ids.length) return [];

  const include = [...PRICE_INCLUDES];
  if (categoryId) {
    include[0] = { ...PRICE_INCLUDES[0], where: { categoryId }, required: true };
  }

  return MarketPrice.findAll({
    where: { id: ids },
    include,
    order: [['priceDate', 'DESC'], ['avgPrice', 'DESC']],
    limit,
  });
}

/** Price series for a produce, used by the trend chart on the prices page. */
async function priceHistory(produceId, { marketId, days = 90, unit } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = {
    produceId,
    priceDate: { [Op.gte]: since.toISOString().slice(0, 10) },
    isPublished: true,
  };
  if (marketId) where.marketId = marketId;
  if (unit) where.unit = unit;

  return MarketPrice.findAll({
    where,
    include: [{ model: Market, as: 'market', attributes: ['id', 'name'] }],
    order: [['priceDate', 'ASC']],
  });
}

/** National average per produce — the headline figure on the prices page. */
async function nationalAverages({ limit = 20, categoryId } = {}) {
  const rows = await latestPrices({ categoryId, limit: 1000 });
  const grouped = new Map();

  rows.forEach((row) => {
    const key = `${row.produceId}:${row.unit}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        produceId: row.produceId,
        produce: row.produce,
        unit: row.unit,
        prices: [],
        markets: 0,
        changes: [],
      });
    }
    const entry = grouped.get(key);
    entry.prices.push(Number(row.avgPrice));
    entry.changes.push(Number(row.changePercent || 0));
    entry.markets += 1;
  });

  return [...grouped.values()]
    .map((e) => {
      const avg = e.prices.reduce((a, b) => a + b, 0) / e.prices.length;
      const change = e.changes.reduce((a, b) => a + b, 0) / e.changes.length;
      return {
        produceId: e.produceId,
        produce: e.produce,
        unit: e.unit,
        avgPrice: Number(avg.toFixed(2)),
        minPrice: Math.min(...e.prices),
        maxPrice: Math.max(...e.prices),
        marketCount: e.markets,
        changePercent: Number(change.toFixed(2)),
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
      };
    })
    .sort((a, b) => b.marketCount - a.marketCount)
    .slice(0, limit);
}

/** Fires user price alerts whose threshold this new observation crosses. */
async function checkAlerts(price) {
  const alerts = await PriceAlert.findAll({
    where: {
      produceId: price.produceId,
      isActive: true,
      [Op.or]: [{ marketId: price.marketId }, { marketId: null }],
    },
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'smsNotifications', 'priceAlerts'] },
      { model: Produce, as: 'produce', attributes: ['name'] },
    ],
  });

  const market = await Market.findByPk(price.marketId);
  const avg = Number(price.avgPrice);
  let fired = 0;

  for (const alert of alerts) {
    const target = Number(alert.targetPrice);
    const hit = alert.direction === 'above' ? avg >= target : avg <= target;
    if (!hit || !alert.user?.priceAlerts) continue;

    // Do not re-fire the same alert more than once a day
    if (alert.lastTriggeredAt && Date.now() - new Date(alert.lastTriggeredAt).getTime() < 20 * 60 * 60 * 1000) continue;

    await notify({
      userId: alert.userId,
      title: `${alert.produce.name} hit your target`,
      message: `${alert.produce.name} is GHS ${avg}/${price.unit} at ${market?.name || 'market'} — ${alert.direction} your GHS ${target} target.`,
      type: 'price',
      priority: 'high',
      icon: 'TrendingUp',
      link: '/prices',
      sms: alert.channel !== 'in_app',
      smsTemplate: 'priceAlert',
      smsData: {
        produce: alert.produce.name,
        market: market?.name || 'market',
        price: avg,
        unit: price.unit,
        direction: alert.direction,
        target,
      },
      smsType: 'price_alert',
    });

    await alert.update({ lastTriggeredAt: new Date(), triggerCount: alert.triggerCount + 1 });
    fired += 1;
  }

  if (fired) logger.info(`Price alerts fired: ${fired}`);
  return fired;
}

/** Builds the SMS body for "send me today's prices" from USSD or the cron job. */
async function buildPriceDigest({ regionId, marketId, produceIds, limit = 6 } = {}) {
  const where = { isPublished: true };
  if (regionId) where.regionId = regionId;
  if (marketId) where.marketId = marketId;
  if (produceIds?.length) where.produceId = produceIds;

  // A single-crop digest lists markets; a mixed digest lists crops
  const singleProduce = produceIds?.length === 1;

  // Query the crop directly — filtering a capped list of all crops can drop it entirely
  let rows = await latestPrices({ regionId, marketId, produceId: singleProduce ? produceIds[0] : undefined, limit: 200 });
  if (!rows.length && singleProduce && regionId) {
    // nothing recorded in the caller's region yet: national prices beat no prices
    rows = await latestPrices({ marketId, produceId: produceIds[0], limit: 200 });
  }
  const filtered = produceIds?.length ? rows.filter((r) => produceIds.includes(r.produceId)) : rows;
  const top = filtered.slice(0, limit);

  const lines = top.map((r) => {
    const arrow = r.trend === 'up' ? '+' : r.trend === 'down' ? '-' : '=';
    const label = singleProduce
      ? String(r.market?.name || 'Market').replace(/\s+Market\b/i, '')
      : `${r.produce.name} ${r.unit}`;
    return `${label}: GHS${Math.round(r.avgPrice)} ${arrow}${Math.abs(Math.round(r.changePercent))}%`;
  });

  return {
    lines,
    marketName: singleProduce
      ? `${top[0]?.produce?.name ?? 'Prices'} per ${top[0]?.unit ?? 'unit'}`
      : top[0]?.market?.name || 'National',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    count: top.length,
  };
}

module.exports = {
  recordPrice, latestPrices, priceHistory, nationalAverages,
  checkAlerts, buildPriceDigest, PRICE_INCLUDES,
};
