const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiter');

const phoneRule = body('phone').trim().notEmpty().withMessage('Your phone number is required');

router.post(
  '/register',
  limiter.auth,
  [
    body('fullName').trim().isLength({ min: 3 }).withMessage('Enter your full name'),
    phoneRule,
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address'),
    body('role').optional().isIn(['farmer', 'buyer']).withMessage('Choose farmer or buyer'),
    body('pin').optional({ values: 'falsy' }).matches(/^\d{4}$/).withMessage('Your USSD PIN must be 4 digits'),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  limiter.auth,
  [
    body('identifier').trim().notEmpty().withMessage('Enter your phone number or email'),
    body('password').notEmpty().withMessage('Enter your password'),
  ],
  validate,
  ctrl.login
);

// Separate credential surface for the admin console at /admin
router.post(
  '/admin/login',
  limiter.auth,
  [
    body('identifier').trim().notEmpty().withMessage('Enter your admin email or phone'),
    body('password').notEmpty().withMessage('Enter your password'),
  ],
  validate,
  ctrl.adminLogin
);

router.post('/refresh', ctrl.refresh);
router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);

router.post(
  '/otp/request',
  limiter.otp,
  [phoneRule, body('purpose').optional().isIn(['registration', 'login', 'reset_password', 'reset_pin', 'verify_phone', 'transaction'])],
  validate,
  ctrl.requestOtp
);

router.post(
  '/otp/verify',
  limiter.auth,
  [phoneRule, body('code').trim().isLength({ min: 4, max: 8 }).withMessage('Enter the code we sent you')],
  validate,
  ctrl.verifyOtp
);

router.post('/password/reset', limiter.auth, ctrl.resetPassword);
router.patch('/password', protect, ctrl.changePassword);
router.patch('/pin', protect, [body('pin').matches(/^\d{4}$/).withMessage('Your PIN must be 4 digits')], validate, ctrl.setPin);

module.exports = router;
