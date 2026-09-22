const env = require('../config/env');
const logger = require('../utils/logger');
const { SmsMessage, User, Op } = require('../models');
const { getProvider } = require('./smsProviders');
const { render } = require('./smsTemplates');
const { normalizePhone, toInternational, detectNetwork, sleep } = require('../utils/helpers');

/** GSM-7 alphabet fits 160 chars per segment; anything else drops to 70. */
function countSegments(text) {
  const unicode = /[^\x00-\x7F -ÿ]/.test(text);
  const size = unicode ? 67 : 153;
  return text.length <= (unicode ? 70 : 160) ? 1 : Math.ceil(text.length / size);
}

/** Order, payment and security messages always go out, opt-out or not. */
const ALWAYS_SEND = ['otp', 'order', 'payment'];

/** The safe-mode numbers, normalised so 0593…, +233593… and 233593… all match. */
const allowlist = () => env.sms.allowlist.map(normalizePhone).filter(Boolean);

/**
 * Safe mode only matters when messages really leave the building: the mock
 * provider sends nothing, so everything stays visible in the log there.
 */
const safeModeBlocks = (recipient, providerName) => {
  const list = allowlist();
  return providerName !== 'mock' && list.length > 0 && !list.includes(recipient);
};
const SAFE_MODE_REASON = 'Safe mode: not in SMS_ALLOWLIST, so the gateway was not called';

/**
 * Platform messages are written starting "AgriMart: ..." (or "AgriMart PRICE
 * ALERT: ...") so they are recognisable when sent from a shared number. With
 * an approved sender ID the handset already shows AgriMart as the sender, so
 * the tag is dropped and the message starts straight away. Text an admin
 * typed by hand (raw) is never changed.
 */
const BRAND_TAG = /^AgriMart(?: Ghana)?\b[ \t]*:?[ \t]*/;
function withBrand(body, raw = false) {
  if (raw || !env.sms.senderId) return body;
  const bare = body.replace(BRAND_TAG, '');
  if (bare === body || !bare) return body;
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/** The row is written before the gateway is called, so the log is complete even when sending fails. */
function createRecord({ recipient, body, userId, type, relatedType, relatedId, broadcastId }) {
  return SmsMessage.create({
    direction: 'outbound',
    recipient,
    sender: env.sms.senderId || env.sms.shortCode || env.appName,
    message: body,
    userId: userId ?? null,
    type,
    status: 'queued',
    provider: env.sms.provider,
    network: detectNetwork(recipient),
    segments: countSegments(body),
    relatedType: relatedType ?? null,
    relatedId: relatedId ?? null,
    broadcastId: broadcastId ?? null,
  });
}

/** Writes the gateway's answer back onto the message row. */
async function applyResult(record, result, providerName) {
  if (result.success) {
    await record.update({
      status: providerName === 'mock' ? 'delivered' : 'sent',
      providerMessageId: result.messageId,
      cost: (result.cost || 0.035) * record.segments,
      sentAt: new Date(),
      deliveredAt: providerName === 'mock' ? new Date() : null,
    });
  } else {
    await record.update({
      status: 'failed',
      errorMessage: String(result.error || 'Unknown error').substring(0, 250),
    });
    logger.warn(`SMS to ${record.recipient} failed: ${result.error}`);
  }
  return result;
}

/**
 * Single entry point for every outbound SMS in the platform. Persists the
 * message first so the admin SMS log is a complete audit trail even when the
 * gateway fails, then hands it to the configured provider.
 */
async function sendSms({
  to,
  message,
  template,
  data = {},
  type = 'system',
  userId = null,
  relatedType = null,
  relatedId = null,
  broadcastId = null,
  force = false,
  raw = false,
}) {
  const recipient = normalizePhone(to);
  if (!recipient) {
    logger.warn('sendSms called without a usable recipient');
    return { success: false, error: 'Invalid recipient' };
  }

  const body = withBrand(template ? render(template, data) : message || '', raw);
  if (!body) return { success: false, error: 'Empty message body' };

  // Respect the user's SMS preference unless this is a transactional must-send
  if (userId && !force) {
    const user = await User.findByPk(userId);
    if (user && user.smsNotifications === false && !ALWAYS_SEND.includes(type)) {
      logger.sms(`Skipped ${type} to ${recipient} — user opted out of SMS`);
      return { success: false, skipped: true, error: 'User opted out' };
    }
  }

  const record = await createRecord({ recipient, body, userId, type, relatedType, relatedId, broadcastId });

  if (!env.sms.enabled) {
    await record.update({ status: 'failed', errorMessage: 'SMS delivery is disabled (SMS_ENABLED=false)' });
    return { success: false, error: 'SMS disabled', record };
  }

  const provider = getProvider();
  if (safeModeBlocks(recipient, provider.name)) {
    await record.update({ status: 'skipped', errorMessage: SAFE_MODE_REASON });
    logger.sms(`Safe mode: logged ${type} to ${recipient} without sending`);
    return { success: false, skipped: true, error: SAFE_MODE_REASON, record };
  }

  await record.update({ status: 'sending' });
  const result = await provider.send({ to: recipient, message: body, senderId: env.sms.senderId });
  await applyResult(record, result, provider.name);

  return { ...result, record };
}

/**
 * Bulk send: one gateway call per batch of identical messages when the
 * provider supports many recipients (Africa's Talking does), otherwise one
 * call per farmer. A nationwide price digest is thousands of messages, so the
 * difference is thousands of API calls against a handful.
 */
async function sendBulkSms(recipients, payload, { batchSize = 100, delayMs = 250, onProgress } = {}) {
  const summary = { total: recipients.length, sent: 0, failed: 0, skipped: 0, results: [] };

  // Accept plain phone strings or user rows. Read the fields explicitly:
  // spreading a Sequelize instance copies its internals, not id/phone/fullName.
  const people = recipients
    .map((r) => (typeof r === 'string'
      ? { id: null, phone: normalizePhone(r), fullName: undefined }
      : { id: r.id ?? null, phone: normalizePhone(r.phone), fullName: r.fullName }))
    .filter((r) => r.phone);

  // One query instead of one per recipient for the opt-out check
  let optedOut = new Set();
  if (!payload.force && !ALWAYS_SEND.includes(payload.type)) {
    const ids = people.map((p) => p.id).filter(Boolean);
    if (ids.length) {
      const rows = await User.findAll({
        where: { id: { [Op.in]: ids }, smsNotifications: false },
        attributes: ['id'],
      });
      optedOut = new Set(rows.map((r) => r.id));
    }
  }
  const reachable = people.filter((p) => !optedOut.has(p.id));
  summary.skipped = people.length - reachable.length;

  const provider = getProvider();
  const canBatch = env.sms.enabled && typeof provider.sendMany === 'function';

  const bodyFor = (person) => withBrand(
    payload.template
      ? render(payload.template, { ...(payload.data || {}), name: person.fullName })
      : payload.message || '',
    payload.raw
  );

  // Safe mode: log what these people would have received, in one insert
  const held = reachable.filter((p) => safeModeBlocks(p.phone, provider.name));
  const audience = reachable.filter((p) => !safeModeBlocks(p.phone, provider.name));
  if (held.length) {
    await SmsMessage.bulkCreate(held.map((person) => {
      const body = bodyFor(person) || '';
      return {
        direction: 'outbound',
        recipient: person.phone,
        sender: env.sms.senderId || env.sms.shortCode || env.appName,
        message: body,
        userId: person.id ?? null,
        type: payload.type || 'system',
        status: 'skipped',
        errorMessage: SAFE_MODE_REASON,
        provider: env.sms.provider,
        network: detectNetwork(person.phone),
        segments: countSegments(body),
        relatedType: payload.relatedType ?? null,
        relatedId: payload.relatedId ?? null,
        broadcastId: payload.broadcastId ?? null,
      };
    }));
    summary.skipped += held.length;
  }

  for (let i = 0; i < audience.length; i += batchSize) {
    const batch = audience.slice(i, i + batchSize);

    // Group by the exact text: personalised messages cannot share one call
    const groups = new Map();
    for (const person of batch) {
      const body = bodyFor(person);
      if (!body) continue;
      if (!groups.has(body)) groups.set(body, []);
      groups.get(body).push(person);
    }

    for (const [body, group] of groups) {
      if (canBatch && group.length > 1) {
        await sendGroup(body, group, payload, provider, summary);
      } else {
        const settled = await Promise.all(
          group.map((person) =>
            sendSms({
              ...payload,
              to: person.phone,
              userId: person.id ?? null,
              data: { ...(payload.data || {}), name: person.fullName },
            }).catch((err) => ({ success: false, error: err.message }))
          )
        );
        settled.forEach((res) => tally(summary, res));
      }
    }

    if (onProgress) onProgress(summary);
    if (i + batchSize < audience.length) await sleep(delayMs);
  }

  logger.sms(
    `Bulk send complete: ${summary.sent} sent, ${summary.failed} failed` +
    (summary.skipped ? `, ${summary.skipped} skipped (opted out or safe mode)` : '')
  );
  return summary;
}

/** Counts one gateway answer into the running summary. */
function tally(summary, res) {
  if (res.success) summary.sent += 1;
  else summary.failed += 1;
  summary.results.push({ success: res.success, error: res.error });
}

/** Sends one identical message to many numbers in a single gateway call. */
async function sendGroup(body, group, payload, provider, summary) {
  const rows = await Promise.all(
    group.map((person) =>
      createRecord({
        recipient: person.phone,
        body,
        userId: person.id ?? null,
        type: payload.type || 'system',
        relatedType: payload.relatedType,
        relatedId: payload.relatedId,
        broadcastId: payload.broadcastId,
      })
    )
  );
  await SmsMessage.update({ status: 'sending' }, { where: { id: rows.map((r) => r.id) } });

  const result = await provider.sendMany({
    to: group.map((p) => p.phone),
    message: body,
    senderId: env.sms.senderId,
  });

  // Match the gateway's per-number answers back to our rows
  const byNumber = new Map(
    (result.results || []).map((r) => [normalizePhone(r.to) || r.to, r])
  );
  await Promise.all(
    rows.map((row) => {
      const answer = byNumber.get(row.recipient)
        || byNumber.get(toInternational(row.recipient))
        // Whole-request failure: every row shares the same reason
        || { success: false, error: result.error || 'The gateway did not report this number' };
      return applyResult(row, answer, provider.name).then((res) => tally(summary, res));
    })
  );
}

/** Logs an inbound SMS (delivery reports / keyword commands from farmers). */
async function logInbound({ from, to, message, providerMessageId }) {
  const phone = normalizePhone(from);
  const user = await User.findOne({ where: { phone } });
  return SmsMessage.create({
    direction: 'inbound',
    recipient: to || env.sms.shortCode || env.sms.senderId,
    sender: phone,
    message,
    userId: user ? user.id : null,
    type: 'inbound_command',
    status: 'delivered',
    provider: env.sms.provider,
    providerMessageId,
    network: detectNetwork(phone),
    deliveredAt: new Date(),
  });
}

/**
 * What the admin SMS centre shows: which gateway is in use, whether it is
 * configured, how much credit is left, and the callback URLs to paste into
 * the gateway's dashboard.
 */
async function gatewayStatus() {
  const provider = getProvider();
  const at = env.sms.africastalking;
  const isAt = provider.name === 'africastalking';
  const base = `${env.publicUrl}${env.apiPrefix}`;
  const suffix = env.gatewaySecret ? `?secret=${env.gatewaySecret}` : '';

  const status = {
    provider: provider.name,
    enabled: env.sms.enabled,
    senderId: env.sms.senderId,
    shortCode: at.shortCode || null,
    ussdServiceCode: env.ussd.serviceCode,
    environment: isAt ? (at.sandbox ? 'sandbox' : 'live') : null,
    username: isAt ? at.username : null,
    configured: provider.name === 'mock' || !isAt || !!at.apiKey,
    publicUrl: env.publicUrl,
    isLocalUrl: /localhost|127\.0\.0\.1/.test(env.publicUrl),
    secretSet: !!env.gatewaySecret,
    callbacks: {
      ussd: `${base}/ussd${suffix}`,
      inboundSms: `${base}/sms/inbound${suffix}`,
      deliveryReports: `${base}/sms/delivery-report${suffix}`,
    },
    balance: null,
    currency: env.platform.currency,
    error: null,
    // Something worth knowing that is not a fault, e.g. a key without balance rights
    note: null,
    // Real gateway + allowlist: only these numbers receive messages
    safeMode: provider.name !== 'mock' && allowlist().length > 0,
    allowlist: allowlist(),
  };

  if (typeof provider.balance === 'function' && status.configured) {
    const result = await provider.balance();
    if (result.success) {
      status.balance = result.balance;
      status.currency = result.currency || status.currency;
    } else if (result.unsupported) {
      status.note = result.error || null;
    } else {
      status.error = result.error || null;
    }
  } else if (!status.configured) {
    status.error = 'AT_API_KEY is not set in agrimarket-backend/.env';
  }

  return status;
}

async function getStats(since) {
  const where = since ? { createdAt: { [Op.gte]: since } } : {};
  // Safe-mode rows never reached the gateway, so they do not count against delivery
  const [total, delivered, failed, inbound] = await Promise.all([
    SmsMessage.count({ where: { ...where, direction: 'outbound', status: { [Op.ne]: 'skipped' } } }),
    SmsMessage.count({ where: { ...where, direction: 'outbound', status: ['sent', 'delivered'] } }),
    SmsMessage.count({ where: { ...where, direction: 'outbound', status: ['failed', 'rejected'] } }),
    SmsMessage.count({ where: { ...where, direction: 'inbound' } }),
  ]);
  const cost = (await SmsMessage.sum('cost', { where })) || 0;
  return {
    total,
    delivered,
    failed,
    inbound,
    deliveryRate: total ? Number(((delivered / total) * 100).toFixed(1)) : 0,
    cost: Number(cost.toFixed ? cost.toFixed(2) : cost),
  };
}

module.exports = { sendSms, sendBulkSms, logInbound, getStats, gatewayStatus, countSegments };
