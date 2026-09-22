const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const build = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max: env.isDev ? max * 20 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    skip: () => env.isDev && process.env.DISABLE_RATE_LIMIT === 'true',
  });

module.exports = {
  general: build(15 * 60 * 1000, 600, 'Too many requests. Please slow down and try again shortly.'),
  auth: build(15 * 60 * 1000, 15, 'Too many sign-in attempts. Please wait 15 minutes and try again.'),
  otp: build(60 * 60 * 1000, 8, 'Too many verification codes requested. Please try again in an hour.'),
  write: build(60 * 1000, 40, 'You are creating records too quickly. Please wait a moment.'),
  // USSD gateways legitimately burst: one session is many rapid requests
  ussd: build(60 * 1000, 200, 'USSD gateway rate limit reached.'),
};
