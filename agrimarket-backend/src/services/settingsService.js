const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * The platform settings an administrator edits under Admin → Settings.
 *
 * Everything that depends on them — SMS wording, USSD screens, withdrawals,
 * listing rules, scheduled jobs and the public website — reads them through
 * here, so a saved change takes effect at once. Values are cached in memory:
 * loaded at start-up and reloaded whenever the admin console saves.
 *
 * The defaults are what a fresh install uses before the table has been read.
 */
const DEFAULTS = {
  platform_name: () => env.appName,
  platform_tagline: 'Every farmer, every market, every price — on any phone.',
  support_phone: '0302000000',
  support_email: 'support@agrimart.gh',
  office_address: 'Agric Ridge, Accra, Ghana',
  ussd_code: () => env.ussd.serviceCode,
  sms_short_code: () => env.sms.shortCode,
  sms_sender_id: () => env.sms.senderId,
  commission_rate: () => env.platform.commissionRate,
  min_withdrawal: 10,
  withdrawal_fee_rate: 0.01,
  listing_expiry_days: 45,
  perishable_expiry_days: 7,
  max_listing_images: 5,
  auto_approve_listings: true,
  // 0 means no limit. A cap keeps one account from flooding the marketplace,
  // by accident (a stuck USSD session) or on purpose.
  max_active_listings: 25,
  daily_digest_enabled: true,
  maintenance_mode: false,
  registration_open: true,
};

/** What the website may read without signing in. */
const PUBLIC_KEYS = [
  'platform_name', 'platform_tagline', 'support_phone', 'support_email', 'office_address',
  'ussd_code', 'sms_short_code', 'commission_rate', 'min_withdrawal', 'withdrawal_fee_rate',
  'max_listing_images', 'listing_expiry_days', 'perishable_expiry_days',
  'maintenance_mode', 'registration_open',
];

let values = {};
let loaded = false;

const fallback = (key) => (typeof DEFAULTS[key] === 'function' ? DEFAULTS[key]() : DEFAULTS[key]);

/** A setting's value, typed (numbers are numbers, switches are booleans). */
function get(key) {
  if (Object.prototype.hasOwnProperty.call(values, key) && values[key] !== null && values[key] !== undefined) {
    return values[key];
  }
  return fallback(key);
}

/**
 * Settings that older code reads from `env` are copied onto it, so every
 * existing `env.ussd.serviceCode` or `env.sms.senderId` follows the console
 * without each caller having to change.
 */
function applyToEnv() {
  env.appName = get('platform_name') || env.appName;
  env.ussd.serviceCode = get('ussd_code') || env.ussd.serviceCode;
  const sender = values.sms_sender_id;
  if (sender !== undefined && sender !== null) env.sms.senderId = String(sender).trim();
  const shortCode = values.sms_short_code;
  if (shortCode !== undefined && shortCode !== null) {
    env.sms.shortCode = String(shortCode).trim();
    env.sms.africastalking.shortCode = env.sms.shortCode;
  }
  const commission = Number(get('commission_rate'));
  if (Number.isFinite(commission) && commission >= 0 && commission < 1) env.platform.commissionRate = commission;
}

/** Reads every setting from the database. Safe to call again at any time. */
async function load() {
  const { Setting } = require('../models');
  try {
    const rows = await Setting.findAll();
    const next = {};
    rows.forEach((row) => { next[row.key] = Setting.parse(row); });
    values = next;
    loaded = true;
    applyToEnv();
  } catch (err) {
    logger.warn('Settings could not be read, using defaults:', err.message);
  }
  return values;
}

/** The subset the public website shows: contact details, codes, limits, switches. */
function publicSettings() {
  const { demoPhones } = require('../ussd/demo');
  return {
    ...Object.fromEntries(PUBLIC_KEYS.map((key) => [key, get(key)])),
    // The account the website's phone simulator is allowed to open. Sent to the
    // browser so the demo can offer it instead of letting a visitor type a
    // number the sandbox will refuse.
    ussd_demo_phone: demoPhones()[0] || '',
  };
}

/** "0579990000" -> "057 999 0000": easier to read and to dial from an SMS. */
function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return String(phone || '');
}

/** The support line as it should appear in a message. */
const supportLine = () => formatPhone(get('support_phone'));

module.exports = {
  DEFAULTS, PUBLIC_KEYS, get, load, refresh: load, publicSettings, formatPhone, supportLine,
  isLoaded: () => loaded,
};
