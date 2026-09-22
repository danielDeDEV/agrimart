const cron = require('node-cron');
const env = require('../config/env');
const { Listing, Offer, Order, User, Broadcast, Otp, Op } = require('../models');
const logger = require('../utils/logger');
const { get: setting } = require('../services/settingsService');
const { expireStaleSessions } = require('../ussd/engine');
const { sendSms, sendBulkSms } = require('../services/smsService');
const priceService = require('../services/priceService');

const options = { scheduled: false };
const accraOptions = { scheduled: false, timezone: 'Africa/Accra' };

/** Every 5 minutes: close USSD sessions the farmer walked away from. */
const ussdCleanup = cron.schedule('*/5 * * * *', async () => {
  try {
    await expireStaleSessions();
  } catch (err) {
    logger.warn('USSD cleanup failed:', err.message);
  }
}, options);

/** Hourly: expire stale listings, offers and one-time passwords. */
const expirySweep = cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();

    const [listings] = await Listing.update(
      { status: 'expired' },
      { where: { status: 'active', expiresAt: { [Op.lt]: now } } }
    );

    const [offers] = await Offer.update(
      { status: 'expired' },
      { where: { status: ['pending', 'countered'], expiresAt: { [Op.lt]: now } } }
    );

    const otps = await Otp.destroy({
      where: { expiresAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    if (listings || offers || otps) {
      logger.info(`Expiry sweep: ${listings} listing(s), ${offers} offer(s), ${otps} OTP(s)`);
    }
  } catch (err) {
    logger.warn('Expiry sweep failed:', err.message);
  }
}, options);

/**
 * 06:30 every morning: SMS the daily price digest to farmers who opted in.
 * Timing matters — farmers decide at dawn whether travelling to market pays.
 */
const dailyPriceDigest = cron.schedule('30 6 * * *', async () => {
  try {
    if (!setting('daily_digest_enabled')) return;
    const farmers = await User.findAll({
      where: { role: 'farmer', status: 'active', priceAlerts: true, smsNotifications: true },
      attributes: ['id', 'fullName', 'phone', 'regionId'],
    });
    if (!farmers.length) return;

    // Group by region so each farmer sees markets they can actually reach
    const byRegion = farmers.reduce((acc, f) => {
      const key = f.regionId || 'none';
      (acc[key] = acc[key] || []).push(f);
      return acc;
    }, {});

    let sent = 0;
    for (const [regionId, group] of Object.entries(byRegion)) {
      const digest = await priceService.buildPriceDigest({
        regionId: regionId === 'none' ? undefined : Number(regionId),
        limit: 5,
      });
      if (!digest.lines.length) continue;

      const summary = await sendBulkSms(group, {
        template: 'priceDigest',
        data: digest,
        type: 'price_digest',
      });
      sent += summary.sent;
    }

    logger.success(`Daily price digest delivered to ${sent} farmer(s)`);
  } catch (err) {
    logger.error('Daily price digest failed:', err.message);
  }
}, accraOptions);

/** Every 10 minutes: nudge farmers sitting on unanswered orders. */
const orderReminders = cron.schedule('*/10 * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await Order.findAll({
      where: { status: 'pending', createdAt: { [Op.lt]: cutoff } },
      include: [{ model: User, as: 'farmer', attributes: ['id', 'fullName', 'phone'] }],
      limit: 50,
    });

    let reminded = 0;
    for (const order of stale) {
      const timeline = Array.isArray(order.timeline) ? order.timeline : [];
      if (timeline.some((t) => t.status === 'reminder')) continue;

      await sendSms({
        to: order.farmer.phone,
        userId: order.farmerId,
        message: `AgriMart: Order ${order.code} is still waiting for your response. Dial ${env.ussd.serviceCode} and choose My Orders to accept or decline.`,
        type: 'reminder',
        relatedType: 'order',
        relatedId: order.id,
      });

      order.pushTimeline('reminder', 'Reminder sent to farmer', 'system');
      await order.update({ timeline: order.timeline });
      reminded += 1;
    }

    if (reminded) logger.info(`Sent ${reminded} order reminder(s)`);
  } catch (err) {
    logger.warn('Order reminders failed:', err.message);
  }
}, options);

/** Every minute: release broadcasts whose scheduled time has arrived. */
const scheduledBroadcasts = cron.schedule('* * * * *', async () => {
  try {
    const due = await Broadcast.findAll({
      where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } },
      limit: 5,
    });

    for (const broadcast of due) {
      await broadcast.update({ status: 'sending' });

      const where = { status: 'active', smsNotifications: true };
      if (broadcast.audience === 'farmers') where.role = 'farmer';
      if (broadcast.audience === 'buyers') where.role = 'buyer';
      if (broadcast.audience === 'region') where.regionId = broadcast.filters?.regionId;

      const recipients = await User.findAll({ where, attributes: ['id', 'fullName', 'phone'] });
      const summary = await sendBulkSms(recipients, {
        message: broadcast.message,
        type: 'broadcast',
        broadcastId: broadcast.id,
        raw: true, // the admin's own words, sent as typed
      });

      await broadcast.update({
        status: 'sent',
        sentCount: summary.sent,
        failedCount: summary.failed,
        sentAt: new Date(),
      });
      logger.success(`Scheduled broadcast "${broadcast.title}" sent to ${summary.sent}`);
    }
  } catch (err) {
    logger.warn('Scheduled broadcast run failed:', err.message);
  }
}, options);

/** Weekly on Monday 07:00: re-engage farmers who have not listed in a while. */
const weeklyEngagement = cron.schedule('0 7 * * 1', async () => {
  try {
    const dormant = await User.findAll({
      where: {
        role: 'farmer',
        status: 'active',
        smsNotifications: true,
        [Op.or]: [
          { lastUssdAt: { [Op.lt]: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) } },
          { lastUssdAt: null },
        ],
      },
      attributes: ['id', 'fullName', 'phone'],
      limit: 500,
    });
    if (!dormant.length) return;

    const summary = await sendBulkSms(dormant, {
      message: `AgriMart: Buyers are looking for produce this week. Dial ${env.ussd.serviceCode} to list what you have — it is free and takes one minute.`,
      type: 'reminder',
    });
    logger.success(`Weekly re-engagement sent to ${summary.sent} farmer(s)`);
  } catch (err) {
    logger.warn('Weekly engagement failed:', err.message);
  }
}, accraOptions);

const registry = [
  ['USSD session cleanup (every 5 min)', ussdCleanup],
  ['Expiry sweep (hourly)', expirySweep],
  ['Daily price digest (06:30 Accra)', dailyPriceDigest],
  ['Order reminders (every 10 min)', orderReminders],
  ['Scheduled broadcasts (every min)', scheduledBroadcasts],
  ['Weekly re-engagement (Mon 07:00)', weeklyEngagement],
];

function startJobs() {
  registry.forEach(([name, task]) => {
    task.start();
    logger.info(`Job scheduled — ${name}`);
  });
}

function stopJobs() {
  registry.forEach(([, task]) => task.stop());
}

module.exports = { startJobs, stopJobs };
