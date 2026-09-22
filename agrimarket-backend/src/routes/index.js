const router = require('express').Router();
const env = require('../config/env');
const adminController = require('../controllers/adminController');

router.get('/', (_req, res) =>
  res.json({
    success: true,
    message: `${env.appName} API`,
    version: '1.0.0',
    documentation: `${env.appUrl}/docs`,
    ussdServiceCode: env.ussd.serviceCode,
    endpoints: {
      auth: `${env.apiPrefix}/auth`,
      listings: `${env.apiPrefix}/listings`,
      orders: `${env.apiPrefix}/orders`,
      offers: `${env.apiPrefix}/offers`,
      prices: `${env.apiPrefix}/prices`,
      reference: `${env.apiPrefix}/reference`,
      ussd: `${env.apiPrefix}/ussd`,
      sms: `${env.apiPrefix}/sms`,
      tips: `${env.apiPrefix}/tips`,
      stats: `${env.apiPrefix}/stats`,
      admin: `${env.apiPrefix}/admin`,
    },
  })
);

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/listings', require('./listing.routes'));
router.use('/orders', require('./order.routes'));
router.use('/offers', require('./offer.routes'));
router.use('/prices', require('./price.routes'));
router.use('/reference', require('./reference.routes'));
router.use('/ussd', require('./ussd.routes'));
router.use('/sms', require('./sms.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/messages', require('./message.routes'));
router.use('/support', require('./support.routes'));
router.use('/tips', require('./content.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/admin', require('./admin.routes'));

router.get('/settings/public', adminController.publicSettings);

module.exports = router;
