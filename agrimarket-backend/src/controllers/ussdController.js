const env = require('../config/env');
const { UssdSession, User, Op, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { paginate, normalizePhone, daysAgo } = require('../utils/helpers');
const { handleRequest } = require('../ussd/engine');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

/**
 * POST /ussd — the aggregator webhook.
 *
 * Africa's Talking posts form-encoded { sessionId, serviceCode, phoneNumber,
 * text } and expects a plain-text "CON ..." / "END ..." body. Hubtel and Nalo
 * use slightly different field names, so we accept all of the common spellings.
 */
exports.gateway = async (req, res) => {
  const body = { ...req.body, ...req.query };

  const sessionId = body.sessionId || body.sessionID || body.SessionId || body.session_id;
  const phoneNumber = body.phoneNumber || body.msisdn || body.Mobile || body.mobile || body.from;
  const text = body.text ?? body.userData ?? body.Message ?? body.message ?? '';
  const serviceCode = body.serviceCode || body.ServiceCode || env.ussd.serviceCode;
  const networkCode = body.networkCode || body.Operator || body.network;

  // Plain text is what every aggregator expects back, on every path: a JSON
  // error page would reach the farmer as "service unavailable" mid-session.
  const reply = (screen) => res.status(200).set('Content-Type', 'text/plain; charset=utf-8').send(screen);

  if (!sessionId || !phoneNumber) return reply('END Invalid USSD request.');

  try {
    const { response } = await handleRequest({ sessionId, phoneNumber, text, serviceCode, networkCode });
    return reply(response);
  } catch (err) {
    logger.error(`USSD gateway error (${sessionId}):`, err.message, err.stack);
    return reply('END Sorry, the service had a problem. Please dial again.');
  }
};

/**
 * POST /ussd/simulate — drives the same engine from the website's phone
 * simulator, returning JSON so the UI can render a handset screen. Sessions
 * created this way are flagged isSimulated so they never pollute real analytics.
 */
exports.simulate = asyncHandler(async (req, res) => {
  const { sessionId, phoneNumber, text = '' } = req.body;

  const phone = normalizePhone(phoneNumber);
  if (!phone) throw ApiError.badRequest('Enter a Ghanaian phone number, e.g. 0244123456');

  const sid = sessionId || `SIM-${uuid()}`;
  const { response, session } = await handleRequest({
    sessionId: sid,
    phoneNumber: phone,
    text,
    serviceCode: env.ussd.serviceCode,
    isSimulated: true,
  });

  const isEnd = response.startsWith('END');
  return ok(res, {
    sessionId: sid,
    screen: response.substring(4),
    type: isEnd ? 'END' : 'CON',
    ended: isEnd,
    state: session?.state,
    step: session?.stepCount,
  });
});

/** DELETE /ussd/simulate/:sessionId — lets the simulator start over cleanly. */
exports.resetSimulation = asyncHandler(async (req, res) => {
  await UssdSession.destroy({ where: { sessionId: req.params.sessionId, isSimulated: true } });
  return ok(res, null, 'Simulator session cleared');
});

/** GET /ussd/menu — the published menu tree, rendered on the How it works page. */
exports.menuTree = asyncHandler(async (_req, res) => {
  return ok(res, {
    serviceCode: env.ussd.serviceCode,
    tree: [
      {
        key: '1', label: 'Sell Produce',
        description: 'List produce for sale in under a minute',
        steps: ['Choose category', 'Choose produce', 'Choose unit', 'Enter quantity', 'Enter price', 'Choose grade', 'Confirm'],
      },
      {
        key: '2', label: 'Market Prices',
        description: 'Live wholesale prices from major markets',
        steps: ['Choose category', 'Choose produce', 'Choose scope', 'View prices', 'SMS list or set an alert'],
      },
      {
        key: '3', label: 'My Listings',
        description: 'Edit price, mark sold or remove a listing',
        steps: ['Pick a listing', 'Change price / Mark sold / Remove'],
      },
      {
        key: '4', label: 'Buy Produce',
        description: 'Find farmers with stock near you',
        steps: ['Choose category', 'Choose produce', 'Compare offers', 'Order or negotiate'],
      },
      {
        key: '5', label: 'My Orders',
        description: 'Accept, decline and track orders',
        steps: ['Pick an order', 'Accept / Decline / Mark delivered'],
      },
      {
        key: '6', label: 'My Account',
        description: 'Wallet, PIN, language and alerts',
        steps: ['Profile', 'Wallet & withdrawal', 'Change PIN', 'Language', 'Price alerts', 'SMS settings'],
      },
      {
        key: '7', label: 'Help & Support',
        description: 'Guides and a direct line to the support desk',
        steps: ['How to sell', 'How to buy', 'Talk to support', 'Report a problem'],
      },
    ],
  });
});

/** GET /admin/ussd/sessions */
exports.sessions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};

  if (req.query.status) where.status = req.query.status;
  if (req.query.phone) where.phone = { [Op.like]: `%${normalizePhone(req.query.phone)}%` };
  if (req.query.outcome) where.outcome = req.query.outcome;
  if (req.query.includeSimulated !== 'true') where.isSimulated = false;

  const { rows, count } = await UssdSession.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /admin/ussd/sessions/:id — full replay of one session. */
exports.sessionDetail = asyncHandler(async (req, res) => {
  const session = await UssdSession.findByPk(req.params.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'role'] }],
  });
  if (!session) throw ApiError.notFound('Session not found');
  return ok(res, session);
});

/** GET /admin/ussd/analytics — adoption metrics behind objective 5. */
exports.analytics = asyncHandler(async (req, res) => {
  const days = Math.min(180, parseInt(req.query.days, 10) || 30);
  const since = daysAgo(days);
  const base = { createdAt: { [Op.gte]: since }, isSimulated: false };

  const [total, completed, timedOut, uniquePhones] = await Promise.all([
    UssdSession.count({ where: base }),
    UssdSession.count({ where: { ...base, status: 'completed' } }),
    UssdSession.count({ where: { ...base, status: 'timeout' } }),
    UssdSession.count({ where: base, distinct: true, col: 'phone' }),
  ]);

  const outcomes = await UssdSession.findAll({
    where: { ...base, outcome: { [Op.ne]: null } },
    attributes: ['outcome', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['outcome'],
    raw: true,
  });

  const byNetwork = await UssdSession.findAll({
    where: base,
    attributes: ['network', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['network'],
    raw: true,
  });

  const daily = await UssdSession.findAll({
    where: base,
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'sessions'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    raw: true,
  });

  const avgSteps = (await UssdSession.findOne({
    where: base,
    attributes: [[sequelize.fn('AVG', sequelize.col('stepCount')), 'avg']],
    raw: true,
  }))?.avg;

  const avgDuration = (await UssdSession.findOne({
    where: { ...base, status: 'completed' },
    attributes: [[sequelize.fn('AVG', sequelize.col('durationSeconds')), 'avg']],
    raw: true,
  }))?.avg;

  return ok(res, {
    period: { days, since },
    totals: {
      sessions: total,
      completed,
      timedOut,
      uniqueUsers: uniquePhones,
      completionRate: total ? Number(((completed / total) * 100).toFixed(1)) : 0,
      avgSteps: Number(Number(avgSteps || 0).toFixed(1)),
      avgDurationSeconds: Math.round(Number(avgDuration || 0)),
    },
    outcomes: outcomes.map((o) => ({ outcome: o.outcome, count: Number(o.count) })),
    byNetwork: byNetwork.map((n) => ({ network: n.network || 'Unknown', count: Number(n.count) })),
    daily: daily.map((d) => ({ date: d.date, sessions: Number(d.sessions) })),
  });
});
