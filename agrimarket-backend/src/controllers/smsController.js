const { SmsMessage, User, Broadcast, Region, Listing, Produce, Op, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate, normalizePhone, daysAgo } = require('../utils/helpers');
const smsService = require('../services/smsService');
const { LIKE } = require('../utils/search');
const auditService = require('../services/auditService');
const priceService = require('../services/priceService');
const logger = require('../utils/logger');
const { supportLine } = require('../services/settingsService');
const env = require('../config/env');

/**
 * POST /sms/inbound — aggregator webhook for messages farmers send TO us.
 *
 * Keyword commands let a farmer work entirely over SMS when USSD is congested:
 *   PRICE MAIZE        today's maize prices
 *   SELL MAIZE 20 450  list 20 bags at GHS450
 *   HELP               support contact
 *   STOP / START       opt out or back in
 */
exports.inbound = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const from = body.from || body.msisdn || body.sender || body.Mobile;
  const text = String(body.text || body.message || body.Content || '').trim();
  const to = body.to || body.shortCode || body.destination;

  if (!from) return res.status(200).json({ success: false, message: 'Missing sender' });

  await smsService.logInbound({ from, to, message: text, providerMessageId: body.id || body.messageId });

  const reply = await handleKeyword(normalizePhone(from), text);
  if (reply) {
    const replyTo = await User.findOne({ where: { phone: normalizePhone(from) }, attributes: ['id'] });
    await smsService.sendSms({ to: from, message: reply, userId: replyTo?.id ?? null, type: 'system', force: true });
  }

  return res.status(200).json({ success: true });
});

async function handleKeyword(phone, text) {
  const [command, ...args] = text.toUpperCase().split(/\s+/);
  const user = await User.findOne({ where: { phone } });

  switch (command) {
    case 'STOP':
    case 'UNSUBSCRIBE':
      if (user) await user.update({ smsNotifications: false, priceAlerts: false });
      return 'AgriMart: You will no longer receive marketing SMS. Send START to resume. Order and payment alerts continue.';

    case 'START':
    case 'SUBSCRIBE':
      if (user) await user.update({ smsNotifications: true, priceAlerts: true });
      return `AgriMart: You are subscribed again. Dial ${env.ussd.serviceCode} to sell produce and check prices.`;

    case 'HELP':
      return `AgriMart: Dial ${env.ussd.serviceCode} to sell produce, check prices and place orders. Support: ${supportLine()}. Send PRICE <crop> for today prices.`;

    case 'PRICE':
    case 'PRICES': {
      const cropName = args.join(' ');
      if (!cropName) return 'AgriMart: Send PRICE followed by the crop, e.g. PRICE MAIZE';

      const produce = await Produce.findOne({ where: { name: { [LIKE]: `%${cropName}%` } } });
      if (!produce) return `AgriMart: We do not track "${cropName}" yet. Try MAIZE, RICE, TOMATO, YAM or CASSAVA.`;

      const digest = await priceService.buildPriceDigest({
        produceIds: [produce.id],
        regionId: user?.regionId,
        limit: 4,
      });
      if (!digest.lines.length) return `AgriMart: No price data for ${produce.name} yet. Try again tomorrow.`;
      return `AgriMart ${produce.name} ${digest.date}:\n${digest.lines.join('\n')}`;
    }

    case 'SELL': {
      if (!user) return `AgriMart: Register first by dialling ${env.ussd.serviceCode} and choosing 1. It is free.`;
      const [crop, qty, price] = args;
      if (!crop || !qty || !price) return 'AgriMart: Send SELL <crop> <quantity> <price>, e.g. SELL MAIZE 20 450';

      const produce = await Produce.findOne({ where: { name: { [LIKE]: `%${crop}%` } } });
      if (!produce) return `AgriMart: We do not list "${crop}". Dial ${env.ussd.serviceCode} to see all crops.`;
      if (Number.isNaN(Number(qty)) || Number.isNaN(Number(price))) {
        return 'AgriMart: Quantity and price must be numbers, e.g. SELL MAIZE 20 450';
      }

      try {
        const { createListing } = require('../services/listingService');
        const listing = await createListing({
          farmerId: user.id,
          produceId: produce.id,
          quantity: Number(qty),
          unit: produce.defaultUnit,
          pricePerUnit: Number(price),
        }, { channel: 'sms', notifyFarmer: false });
        return `AgriMart: Listed! ${listing.code} - ${qty} ${produce.defaultUnit} of ${produce.name} at GHS${price}. Buyers will call you.`;
      } catch (err) {
        logger.warn('SMS listing failed:', err.message);
        return `AgriMart: Could not create the listing. ${err.message}`;
      }
    }

    case 'BALANCE':
      if (!user) return `AgriMart: No account found for this number. Dial ${env.ussd.serviceCode} to register.`;
      return `AgriMart: Wallet balance GHS ${Number(user.walletBalance).toFixed(2)}. Dial ${env.ussd.serviceCode} then 6 then 2 to withdraw.`;

    default:
      return `AgriMart: Commands - PRICE <crop>, SELL <crop> <qty> <price>, BALANCE, HELP, STOP. Or dial ${env.ussd.serviceCode} for the full menu.`;
  }
}

/** POST /sms/delivery-report — aggregator callback confirming handset delivery. */
/**
 * Delivery receipts. Africa's Talking posts { id, status, phoneNumber,
 * networkCode, failureReason, retryCount }; other gateways use their own
 * spellings of the same three things.
 *
 * AT statuses: Sent, Submitted, Buffered, Success, Rejected, Failed.
 * Failure reasons include InsufficientCredit, InvalidPhoneNumber,
 * UserInBlacklist, UserIsInactive, DoNotDisturbRejection.
 */
const DELIVERY_STATUS = {
  success: 'delivered',
  delivered: 'delivered',
  sent: 'sent',
  submitted: 'sent',
  buffered: 'sent',
  queued: 'sent',
  failed: 'failed',
  expired: 'failed',
  rejected: 'rejected',
  blacklisted: 'rejected',
};

/** Turns AT's CamelCase reason into something readable in the SMS log. */
const readableReason = (reason) =>
  String(reason || '').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || null;

exports.deliveryReport = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const messageId = body.id || body.messageId || body.MessageId;
  const status = String(body.status || body.Status || '').toLowerCase();
  const mapped = DELIVERY_STATUS[status];

  const record = messageId
    ? await SmsMessage.findOne({ where: { providerMessageId: messageId } })
    : null;

  if (record && mapped) {
    const reason = readableReason(body.failureReason || body.reason);
    await record.update({
      status: mapped,
      deliveredAt: mapped === 'delivered' ? new Date() : record.deliveredAt,
      errorMessage: mapped === 'delivered' ? null : reason || record.errorMessage,
    });
    if (mapped !== 'delivered') {
      logger.warn(`SMS ${messageId} to ${record.recipient}: ${status}${reason ? ` — ${reason}` : ''}`);
    }
  } else if (messageId && !record) {
    logger.warn(`Delivery report for an unknown message id ${messageId}`);
  }

  // Always 200: a gateway that gets an error keeps retrying the same receipt
  return res.status(200).json({ success: true });
});

/**
 * GET /admin/sms/gateway — which gateway is configured, how much credit is
 * left and the callback URLs to paste into the gateway's dashboard.
 */
exports.gatewayStatus = asyncHandler(async (_req, res) => {
  return ok(res, await smsService.gatewayStatus());
});

/** GET /admin/sms — the message log. */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 25 });
  const where = {};

  if (req.query.direction) where.direction = req.query.direction;
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    where[Op.or] = [{ recipient: { [LIKE]: term } }, { message: { [LIKE]: term } }];
  }
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
    if (req.query.to) where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59`);
  }

  const { rows, count } = await SmsMessage.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'role'] }],
    // id breaks ties — a command and its reply are often stored in the same second
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /admin/sms/stats */
exports.stats = asyncHandler(async (req, res) => {
  const days = Math.min(180, parseInt(req.query.days, 10) || 30);
  const since = daysAgo(days);

  const overall = await smsService.getStats(since);

  const byType = await SmsMessage.findAll({
    where: { createdAt: { [Op.gte]: since }, direction: 'outbound' },
    attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['type'],
    raw: true,
  });

  const byNetwork = await SmsMessage.findAll({
    where: { createdAt: { [Op.gte]: since }, direction: 'outbound' },
    attributes: ['network', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['network'],
    raw: true,
  });

  const daily = await SmsMessage.findAll({
    where: { createdAt: { [Op.gte]: since } },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
      [sequelize.fn('SUM', sequelize.literal("CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END")), 'inbound'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    raw: true,
  });

  return ok(res, {
    ...overall,
    period: { days, since },
    byType: byType.map((t) => ({ type: t.type, count: Number(t.count) })),
    byNetwork: byNetwork.map((n) => ({ network: n.network || 'Unknown', count: Number(n.count) })),
    daily: daily.map((d) => ({
      date: d.date,
      total: Number(d.total),
      inbound: Number(d.inbound || 0),
      outbound: Number(d.total) - Number(d.inbound || 0),
    })),
  });
});

/** POST /admin/sms/send — one-off message from the console. */
exports.sendOne = asyncHandler(async (req, res) => {
  const { phone, message } = req.body;
  const user = await User.findOne({ where: { phone: normalizePhone(phone) } });

  // raw: the admin's own words go out exactly as typed
  const result = await smsService.sendSms({
    to: phone, message, userId: user?.id, type: 'system', force: true, raw: true,
  });

  const outcome = result.success ? 'Sent' : result.skipped ? 'Logged (safe mode, not sent)' : 'Failed to send';
  await auditService.record(req, {
    action: 'sms.send', entity: 'sms', entityId: result.record?.id,
    description: `${outcome} a direct SMS to ${phone}`,
  });

  // Safe mode held it back on purpose — the gateway was never involved
  if (result.skipped && result.record) {
    throw ApiError.badRequest(
      `Not sent: safe mode is on and ${normalizePhone(phone)} is not in SMS_ALLOWLIST. ` +
      'Add it to agrimarket-backend/.env and restart the API. The message is in the log as Skipped.'
    );
  }
  if (!result.success) throw ApiError.badRequest(`The gateway rejected the message: ${result.error}`);
  return created(res, result.record, `Message sent to ${phone}`);
});

/* ── Broadcast campaigns ──────────────────────────────────────────────── */

/** Resolves an audience definition into the actual recipient list. */
async function resolveAudience(audience, filters = {}) {
  const where = { status: 'active', smsNotifications: true };

  switch (audience) {
    case 'farmers': where.role = 'farmer'; break;
    case 'buyers': where.role = 'buyer'; break;
    case 'agents': where.role = 'agent'; break;
    case 'region': where.regionId = filters.regionId; break;
    case 'district': where.districtId = filters.districtId; break;
    case 'produce': {
      const listings = await Listing.findAll({
        where: { produceId: filters.produceId },
        attributes: ['farmerId'],
        group: ['farmerId'],
        raw: true,
      });
      where.id = listings.map((l) => l.farmerId);
      break;
    }
    case 'custom':
      where.phone = (filters.phones || []).map(normalizePhone).filter(Boolean);
      break;
    default: break; // 'all'
  }

  return User.findAll({ where, attributes: ['id', 'fullName', 'phone', 'regionId'] });
}

/** POST /admin/broadcasts/preview — recipient count and cost before sending. */
exports.previewBroadcast = asyncHandler(async (req, res) => {
  const { audience = 'all', filters = {}, message = '' } = req.body;
  const recipients = await resolveAudience(audience, filters);
  const segments = smsService.countSegments(message || '');

  return ok(res, {
    recipientCount: recipients.length,
    segments,
    estimatedCost: Number((recipients.length * segments * 0.035).toFixed(2)),
    sample: recipients.slice(0, 5).map((r) => ({ name: r.fullName, phone: r.phone })),
  });
});

/** POST /admin/broadcasts — compose and send a campaign. */
exports.createBroadcast = asyncHandler(async (req, res) => {
  const { title, message, audience = 'all', filters = {}, channel = 'sms', scheduledAt } = req.body;

  const recipients = await resolveAudience(audience, filters);
  if (!recipients.length) throw ApiError.badRequest('That audience has no reachable recipients');

  const segments = smsService.countSegments(message);
  const broadcast = await Broadcast.create({
    title,
    message,
    audience,
    filters,
    channel,
    recipientCount: recipients.length,
    estimatedCost: Number((recipients.length * segments * 0.035).toFixed(2)),
    status: scheduledAt ? 'scheduled' : 'sending',
    scheduledAt: scheduledAt || null,
    createdBy: req.user.id,
  });

  await auditService.record(req, {
    action: 'broadcast.create', entity: 'broadcast', entityId: broadcast.id,
    description: `Broadcast "${title}" to ${recipients.length} ${audience}`,
  });

  if (scheduledAt) {
    return created(res, broadcast, `Broadcast scheduled for ${new Date(scheduledAt).toLocaleString()}`);
  }

  // Send in the background so the console does not block on a large campaign
  smsService
    .sendBulkSms(recipients, { message, type: 'broadcast', broadcastId: broadcast.id, raw: true })
    .then((summary) =>
      broadcast.update({
        status: 'sent', sentCount: summary.sent, failedCount: summary.failed, sentAt: new Date(),
      })
    )
    .catch((err) => {
      logger.error('Broadcast failed:', err.message);
      broadcast.update({ status: 'failed' });
    });

  return created(res, broadcast, `Sending to ${recipients.length} recipient(s) now`);
});

/** GET /admin/broadcasts */
exports.listBroadcasts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const { rows, count } = await Broadcast.findAndCountAll({
    include: [{ model: User, as: 'creator', attributes: ['id', 'fullName'] }],
    // id breaks ties — a command and its reply are often stored in the same second
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return paginated(res, rows, { page, limit, total: count });
});

/** GET /sms/mine — a farmer's own SMS history on the website. */
exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const { rows, count } = await SmsMessage.findAndCountAll({
    where: { [Op.or]: [{ userId: req.user.id }, { recipient: req.user.phone }] },
    // id breaks ties — a command and its reply are often stored in the same second
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });
  return paginated(res, rows, { page, limit, total: count });
});
