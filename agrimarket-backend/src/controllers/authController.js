const env = require('../config/env');
const { User, Otp, Region, District, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');
const { normalizePhone, isValidGhanaPhone, generateOtp, detectNetwork } = require('../utils/helpers');
const { sendSms } = require('../services/smsService');
const { notify } = require('../services/notificationService');
const auditService = require('../services/auditService');
const { supportLine, get: setting } = require('../services/settingsService');
const { activity } = require('../sockets/io');
const jwt = require('jsonwebtoken');

const USER_INCLUDES = [
  { model: Region, as: 'region', attributes: ['id', 'name'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
];

const authPayload = async (user) => {
  const fresh = await User.findByPk(user.id, { include: USER_INCLUDES });
  return {
    user: fresh,
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    expiresIn: env.jwt.expiresIn,
  };
};

/** POST /auth/register — web sign-up for farmers and buyers. */
exports.register = asyncHandler(async (req, res) => {
  const { fullName, phone, email, password, role = 'farmer', regionId, districtId, community } = req.body;

  const normalized = normalizePhone(phone);
  if (!isValidGhanaPhone(normalized)) {
    throw ApiError.badRequest('Enter a valid Ghanaian phone number, e.g. 0244123456');
  }
  if (['admin', 'superadmin'].includes(role)) {
    throw ApiError.forbidden('Administrator accounts cannot be created from the public site');
  }
  if (!setting('registration_open')) {
    throw ApiError.forbidden('New registrations are paused at the moment. Please try again later.');
  }

  const existing = await User.findOne({
    where: { [Op.or]: [{ phone: normalized }, ...(email ? [{ email }] : [])] },
    paranoid: false,
  });
  if (existing) {
    throw ApiError.conflict(
      existing.phone === normalized
        ? 'That phone number already has an account. Try signing in instead.'
        : 'That email address is already registered.'
    );
  }

  const user = await User.create({
    fullName,
    phone: normalized,
    email: email || null,
    password,
    pin: req.body.pin || null,
    role,
    regionId: regionId || null,
    districtId: districtId || null,
    community: community || null,
    businessName: req.body.businessName || null,
    businessType: req.body.businessType || null,
    farmSize: req.body.farmSize || null,
    primaryCrops: req.body.primaryCrops || [],
    network: detectNetwork(normalized),
    registrationChannel: 'web',
    status: 'active',
  });

  await sendSms({
    to: user.phone,
    userId: user.id,
    template: role === 'buyer' ? 'welcomeBuyer' : 'welcomeFarmer',
    data: { name: user.firstName(), serviceCode: env.ussd.serviceCode },
    type: 'welcome',
    force: true,
  });

  await notify({
    userId: user.id,
    title: 'Welcome to AgriMart Ghana',
    message:
      role === 'farmer'
        ? 'Your account is ready. Post your first produce listing to reach buyers nationwide.'
        : 'Your account is ready. Browse verified farm produce from across Ghana.',
    type: 'account',
    icon: 'PartyPopper',
    link: '/dashboard',
  });

  activity('user.registered', `${user.fullName} joined as a ${role}`, { userId: user.id });

  return created(res, await authPayload(user), 'Your account has been created');
});

/** POST /auth/login — phone or email plus password. */
exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const normalized = normalizePhone(identifier);

  const user = await User.scope('withSecrets').findOne({
    where: { [Op.or]: [{ phone: normalized }, { email: String(identifier).toLowerCase().trim() }] },
  });

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Those credentials do not match our records');
  }
  if (user.status === 'suspended') throw ApiError.forbidden('Your account has been suspended. Contact support.');
  if (user.status === 'banned') throw ApiError.forbidden('This account has been closed.');
  if (user.isAdmin()) {
    throw ApiError.forbidden('Administrators sign in through the admin console at /admin');
  }

  await user.update({ lastLoginAt: new Date(), loginCount: (user.loginCount || 0) + 1 });
  return ok(res, await authPayload(user), `Welcome back, ${user.firstName()}`);
});

/**
 * POST /auth/admin/login — deliberately separate from the public login so the
 * admin console has its own credential surface, its own audit trail and its own
 * token. A staff account cannot sign in through the farmer login and vice versa.
 */
exports.adminLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const normalized = normalizePhone(identifier);

  const user = await User.scope('withSecrets').findOne({
    where: {
      [Op.or]: [{ phone: normalized }, { email: String(identifier).toLowerCase().trim() }],
      role: ['admin', 'superadmin'],
    },
  });

  if (!user || !(await user.comparePassword(password))) {
    await auditService.record(req, {
      action: 'admin.login_failed',
      entity: 'user',
      description: `Failed admin sign-in for "${identifier}"`,
      severity: 'warning',
    });
    throw ApiError.unauthorized('Invalid administrator credentials');
  }
  if (user.status !== 'active') throw ApiError.forbidden('This administrator account is not active');

  await user.update({ lastLoginAt: new Date(), loginCount: (user.loginCount || 0) + 1 });
  req.user = user;
  await auditService.record(req, {
    action: 'admin.login',
    entity: 'user',
    entityId: user.id,
    description: `${user.fullName} signed in to the admin console`,
  });

  return ok(res, await authPayload(user), `Welcome back, ${user.firstName()}`);
});

/** POST /auth/refresh */
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('A refresh token is required');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    throw ApiError.unauthorized('That session can no longer be refreshed. Please sign in again.');
  }

  const user = await User.findByPk(decoded.id);
  if (!user || user.status !== 'active') throw ApiError.unauthorized('Account unavailable');

  return ok(res, await authPayload(user), 'Session refreshed');
});

/** GET /auth/me */
exports.me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { include: USER_INCLUDES });
  return ok(res, user);
});

/** POST /auth/otp/request — used for phone verification and PIN/password reset. */
exports.requestOtp = asyncHandler(async (req, res) => {
  const { phone, purpose = 'verify_phone' } = req.body;
  const normalized = normalizePhone(phone);
  if (!isValidGhanaPhone(normalized)) throw ApiError.badRequest('Enter a valid Ghanaian phone number');

  const user = await User.findOne({ where: { phone: normalized } });
  if (['reset_password', 'reset_pin', 'login'].includes(purpose) && !user) {
    throw ApiError.notFound('No account is registered with that number');
  }

  await Otp.update({ isUsed: true }, { where: { phone: normalized, purpose, isUsed: false } });

  const code = generateOtp(6);
  await Otp.create({
    phone: normalized,
    code,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendSms({
    to: normalized,
    userId: user?.id,
    template: purpose === 'reset_pin' ? 'pinReset' : 'otp',
    data: { code, purpose },
    type: 'otp',
    force: true,
  });

  return ok(
    res,
    { phone: normalized, expiresIn: 600, ...(env.isDev ? { devCode: code } : {}) },
    `A 6-digit code has been sent to ${normalized}`
  );
});

/** POST /auth/otp/verify */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { phone, code, purpose = 'verify_phone' } = req.body;
  const normalized = normalizePhone(phone);

  const otp = await Otp.findOne({
    where: { phone: normalized, purpose, isUsed: false },
    order: [['createdAt', 'DESC']],
  });

  if (!otp) throw ApiError.badRequest('Request a new code — this one is no longer valid');
  if (!otp.isValid()) {
    await otp.update({ isUsed: true });
    throw ApiError.badRequest('That code has expired. Please request a new one.');
  }
  if (otp.code !== String(code).trim()) {
    await otp.increment('attempts');
    throw ApiError.badRequest(`Incorrect code. ${Math.max(0, 4 - otp.attempts)} attempt(s) remaining.`);
  }

  await otp.update({ isUsed: true, usedAt: new Date() });

  const user = await User.findOne({ where: { phone: normalized } });
  if (user && purpose === 'verify_phone') await user.update({ isPhoneVerified: true });

  const resetToken = ['reset_password', 'reset_pin'].includes(purpose) && user
    ? jwt.sign({ id: user.id, purpose }, env.jwt.secret, { expiresIn: '15m' })
    : undefined;

  return ok(res, { verified: true, resetToken }, 'Code verified');
});

/** POST /auth/password/reset — completes the OTP reset flow. */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password, pin } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(resetToken, env.jwt.secret);
  } catch {
    throw ApiError.unauthorized('This reset link has expired. Start again.');
  }

  const user = await User.scope('withSecrets').findByPk(decoded.id);
  if (!user) throw ApiError.notFound('Account not found');

  if (decoded.purpose === 'reset_pin') {
    if (!/^\d{4}$/.test(String(pin))) throw ApiError.badRequest('Your PIN must be exactly 4 digits');
    user.pin = String(pin);
  } else {
    if (!password || password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
    user.password = password;
  }
  await user.save();

  await sendSms({
    to: user.phone,
    userId: user.id,
    message: `AgriMart: Your ${decoded.purpose === 'reset_pin' ? 'PIN' : 'password'} was changed. If this was not you, call ${supportLine()} immediately.`,
    type: 'system',
    force: true,
  });

  return ok(res, null, 'Your credentials have been updated. You can now sign in.');
});

/** PATCH /auth/password — change while signed in. */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.scope('withSecrets').findByPk(req.user.id);

  if (user.password && !(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect');
  }
  if (!newPassword || newPassword.length < 8) throw ApiError.badRequest('New password must be at least 8 characters');

  user.password = newPassword;
  await user.save();
  return ok(res, null, 'Password updated');
});

/** PATCH /auth/pin — set or change the 4-digit USSD PIN from the website. */
exports.setPin = asyncHandler(async (req, res) => {
  const { pin, currentPin } = req.body;
  if (!/^\d{4}$/.test(String(pin))) throw ApiError.badRequest('Your PIN must be exactly 4 digits');

  const user = await User.scope('withSecrets').findByPk(req.user.id);
  if (user.pin && !(await user.comparePin(currentPin))) {
    throw ApiError.badRequest('Your current PIN is incorrect');
  }

  user.pin = String(pin);
  await user.save();

  await sendSms({
    to: user.phone,
    userId: user.id,
    message: `AgriMart: Your USSD PIN has been set. Dial ${env.ussd.serviceCode} to sell produce and check prices.`,
    type: 'system',
  });

  return ok(res, null, `Your USSD PIN is ready. Dial ${env.ussd.serviceCode} to use it.`);
});

/** POST /auth/logout — token invalidation is client-side; this records the event. */
exports.logout = asyncHandler(async (req, res) => {
  if (req.user?.isAdmin()) {
    await auditService.record(req, {
      action: 'admin.logout',
      entity: 'user',
      entityId: req.user.id,
      description: `${req.user.fullName} signed out`,
    });
  }
  return ok(res, null, 'Signed out');
});
