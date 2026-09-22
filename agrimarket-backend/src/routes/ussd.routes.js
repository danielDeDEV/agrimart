const router = require('express').Router();
const ctrl = require('../controllers/ussdController');
const { gatewayAuth } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiter');

/**
 * The aggregator webhook. Africa's Talking, Hubtel and Nalo are all pointed at
 * this one URL; the controller normalises their differing field names.
 * Both GET and POST are accepted because Hubtel probes with GET.
 */
router.post('/', limiter.ussd, gatewayAuth, ctrl.gateway);
router.get('/', limiter.ussd, gatewayAuth, ctrl.gateway);

// Drives the phone simulator on the website against the very same engine
router.post('/simulate', limiter.ussd, ctrl.simulate);
router.delete('/simulate/:sessionId', ctrl.resetSimulation);

router.get('/menu', ctrl.menuTree);

module.exports = router;
