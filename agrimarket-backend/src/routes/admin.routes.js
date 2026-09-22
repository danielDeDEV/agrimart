const router = require('express').Router();
const { body } = require('express-validator');
const admin = require('../controllers/adminController');
const sms = require('../controllers/smsController');
const ussd = require('../controllers/ussdController');
const support = require('../controllers/supportController');
const content = require('../controllers/contentController');
const team = require('../controllers/teamController');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

/**
 * Everything below lives behind the admin console. The guard is applied once
 * here rather than per route so no admin endpoint can ever be added unguarded.
 */
router.use(protect, restrictTo('admin', 'superadmin'));

// ── Dashboard & analytics ───────────────────────────────────────────────
router.get('/dashboard', admin.dashboard);
router.get('/analytics', admin.analytics);

// ── People ──────────────────────────────────────────────────────────────
router.get('/users', admin.listUsers);
router.post(
  '/users',
  [
    body('fullName').trim().isLength({ min: 3 }).withMessage('Enter a full name'),
    body('phone').trim().notEmpty().withMessage('Enter a phone number'),
  ],
  validate,
  admin.createUser
);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);

// ── Marketplace ─────────────────────────────────────────────────────────
router.get('/listings', admin.listListings);
router.patch(
  '/listings/:id/moderate',
  [body('action').isIn(['approve', 'reject', 'suspend', 'feature']).withMessage('Choose approve, reject, suspend or feature')],
  validate,
  admin.moderateListing
);
router.get('/orders', admin.listOrders);

// ── Money ───────────────────────────────────────────────────────────────
router.get('/transactions', admin.listTransactions);
router.patch('/transactions/:id', admin.updateTransaction);

// ── SMS operations ──────────────────────────────────────────────────────
router.get('/sms', sms.list);
router.get('/sms/stats', sms.stats);
router.get('/sms/gateway', sms.gatewayStatus);
router.post(
  '/sms/send',
  [
    body('phone').trim().notEmpty().withMessage('Enter a recipient number'),
    body('message').trim().isLength({ min: 2, max: 640 }).withMessage('Write a message of up to 640 characters'),
  ],
  validate,
  sms.sendOne
);
router.get('/broadcasts', sms.listBroadcasts);
router.post('/broadcasts/preview', sms.previewBroadcast);
router.post(
  '/broadcasts',
  [
    body('title').trim().notEmpty().withMessage('Give the campaign a title'),
    body('message').trim().isLength({ min: 5, max: 640 }).withMessage('Write the SMS body'),
  ],
  validate,
  sms.createBroadcast
);

// ── USSD operations ─────────────────────────────────────────────────────
router.get('/ussd/sessions', ussd.sessions);
router.get('/ussd/sessions/:id', ussd.sessionDetail);
router.get('/ussd/analytics', ussd.analytics);

// ── Support desk ────────────────────────────────────────────────────────
router.get('/support', support.list);
router.get('/support/stats', support.stats);
router.patch('/support/:id', support.update);

// ── Knowledge base ──────────────────────────────────────────────────────
router.get('/tips', content.adminList);
router.get('/tips/:id', content.adminGetOne);
router.post('/tips', content.create);
router.patch('/tips/:id', content.update);
router.delete('/tips/:id', content.remove);
router.post('/tips/:id/broadcast', content.broadcast);

// ── Impact evaluation (study objective 5) ───────────────────────────────
router.get('/impact', admin.listImpact);
router.post('/impact', admin.createImpact);

// ── Admin team (staff accounts) ─────────────────────────────────────────
// Any admin can see the team; only a super administrator can change it.
router.get('/team', team.list);
router.post(
  '/team',
  [
    body('fullName').trim().isLength({ min: 3 }).withMessage('Enter a full name'),
    body('email').trim().isEmail().withMessage('Enter a valid email address'),
    body('phone').trim().notEmpty().withMessage('Enter a phone number'),
    body('role').optional().isIn(['admin', 'superadmin']).withMessage('Choose Admin or Super administrator'),
  ],
  validate,
  team.create
);
router.patch('/team/:id', team.update);
router.post('/team/:id/reset-password', team.resetPassword);
router.delete('/team/:id', team.remove);

// ── Governance ──────────────────────────────────────────────────────────
router.get('/audit-logs', admin.auditLogs);
router.get('/settings', admin.getSettings);
router.patch('/settings', admin.updateSettings);

module.exports = router;
