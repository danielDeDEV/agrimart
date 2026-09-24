const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/smsController');
const validate = require('../middleware/validate');
const { protect, gatewayAuth } = require('../middleware/auth');

// Gateway callbacks: inbound farmer messages and handset delivery receipts
router.post('/inbound', gatewayAuth, ctrl.inbound);
router.get('/inbound', gatewayAuth, ctrl.inbound);
router.post('/delivery-report', gatewayAuth, ctrl.deliveryReport);
router.get('/delivery-report', gatewayAuth, ctrl.deliveryReport);

// The same two with the secret in the path, for gateways that drop the query
// string when they call a callback
router.post('/inbound/:secret', gatewayAuth, ctrl.inbound);
router.get('/inbound/:secret', gatewayAuth, ctrl.inbound);
router.post('/delivery-report/:secret', gatewayAuth, ctrl.deliveryReport);
router.get('/delivery-report/:secret', gatewayAuth, ctrl.deliveryReport);

// A user's own SMS history, shown on the dashboard
router.get('/mine', protect, ctrl.mine);

module.exports = router;
