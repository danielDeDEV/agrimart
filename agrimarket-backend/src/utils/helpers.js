const env = require('../config/env');

/**
 * Ghana numbers arrive from USSD gateways as 233XXXXXXXXX and from web forms as
 * 0XXXXXXXXX. Everything is stored in the local 0XXXXXXXXX form so a farmer who
 * registers over USSD and later logs into the website is the same record.
 */
function normalizePhone(input) {
  if (!input) return null;
  let p = String(input).replace(/[\s\-()+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith(env.platform.countryCode)) p = '0' + p.slice(env.platform.countryCode.length);
  if (p.length === 9 && !p.startsWith('0')) p = '0' + p;
  return p;
}

/** International form used when handing a number to an SMS gateway. */
function toInternational(input) {
  const local = normalizePhone(input);
  if (!local) return null;
  return `+${env.platform.countryCode}${local.replace(/^0/, '')}`;
}

function isValidGhanaPhone(input) {
  const p = normalizePhone(input);
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(p || '');
}

/** MTN / Telecel (Vodafone) / AirtelTigo prefix map — used for USSD analytics. */
const NETWORK_PREFIXES = {
  MTN: ['024', '054', '055', '059', '025', '053'],
  Telecel: ['020', '050'],
  AirtelTigo: ['027', '057', '026', '056'],
  Glo: ['023'],
};

function detectNetwork(phone) {
  const p = normalizePhone(phone) || '';
  const prefix = p.substring(0, 3);
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) return network;
  }
  return 'Unknown';
}

const pad = (n, len = 4) => String(n).padStart(len, '0');

function generateCode(prefix, length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${out}`;
}

const generateOtp = (digits = 6) =>
  String(Math.floor(Math.random() * Math.pow(10, digits))).padStart(digits, '0');

function paginate(query, defaults = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaults.limit || 20));
  return { page, limit, offset: (page - 1) * limit };
}

const formatMoney = (amount, currency = env.platform.currency) =>
  `${currency} ${Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** GHS with no decimals — USSD screens are 160 characters, every char counts. */
const formatMoneyShort = (amount) =>
  `GHS ${Number(amount || 0).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`;

const percentChange = (current, previous) => {
  if (!previous || previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const slugify = (str) =>
  String(str).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chop a string into 160-char SMS pages. */
function chunkSms(text, size = 160) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.substring(i, i + size));
  return parts;
}

const maskPhone = (phone) => {
  const p = normalizePhone(phone) || '';
  return p.length >= 10 ? `${p.slice(0, 3)}****${p.slice(-3)}` : p;
};

const startOfDay = (d = new Date()) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d = new Date()) => new Date(new Date(d).setHours(23, 59, 59, 999));
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

module.exports = {
  normalizePhone, toInternational, isValidGhanaPhone, detectNetwork, NETWORK_PREFIXES,
  generateCode, generateOtp, paginate, formatMoney, formatMoneyShort, percentChange,
  slugify, sleep, chunkSms, maskPhone, pad, startOfDay, endOfDay, daysAgo,
};
