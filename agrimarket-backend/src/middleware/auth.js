const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, uuid: user.uuid, role: user.role, phone: user.phone },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ id: user.id, type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

/** Hard gate — rejects the request when no valid token is present. */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Please sign in to continue');

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Your session has expired, please sign in again' : 'Invalid session token'
    );
  }

  const user = await User.findByPk(decoded.id);
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  if (user.status === 'suspended') throw ApiError.forbidden('Your account has been suspended. Contact support.');
  if (user.status === 'banned') throw ApiError.forbidden('Your account has been closed.');

  req.user = user;
  next();
});

/** Attaches req.user when a token happens to be present, but never blocks. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await User.findByPk(decoded.id);
    if (user && user.status === 'active') req.user = user;
  } catch {
    /* an invalid token on a public route is simply ignored */
  }
  next();
});

const restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This area is restricted to: ${roles.join(', ')}`));
  }
  next();
};

/**
 * The admin console is a separate surface with its own login, so it gets its own
 * guard rather than reusing restrictTo everywhere.
 */
const adminOnly = [protect, restrictTo('admin', 'superadmin')];
const superAdminOnly = [protect, restrictTo('superadmin')];

/** Guards the USSD/SMS gateway webhooks from public abuse. */
/**
 * Guards the USSD/SMS gateway webhooks from public abuse.
 *
 * The secret is accepted from a header, the query string, the posted body, or
 * the end of the path. Gateways differ in what they preserve when they call a
 * callback — some drop the query string entirely — and a farmer who dials into
 * a rejected callback just sees "invalid response", with nothing in the logs
 * to say why. Accepting all four removes that whole class of silent failure.
 *
 * Rejections answer in the gateway's own language: a USSD caller gets an END
 * screen rather than JSON they cannot read.
 */
const gatewayAuth = (req, res, next) => {
  const configured = process.env.GATEWAY_SECRET;
  if (!configured) return next(); // open in development

  const provided =
    req.headers['x-gateway-secret'] ||
    req.query.secret ||
    req.body?.secret ||
    req.params.secret;

  if (provided === configured) return next();

  logger.warn(
    `Rejected a gateway call to ${req.originalUrl.split('?')[0]} — ` +
    `${provided ? 'the secret did not match' : 'no secret was supplied'}. ` +
    'Check the callback URL in the gateway dashboard.'
  );

  // A USSD handset cannot render JSON; say something the caller can read
  if (req.originalUrl.includes('/ussd')) {
    return res.type('text/plain').send('END Service configuration error. Please try again later.');
  }
  return next(ApiError.forbidden('Invalid gateway credentials'));
};

module.exports = {
  protect, optionalAuth, restrictTo, adminOnly, superAdminOnly,
  gatewayAuth, signAccessToken, signRefreshToken,
};
