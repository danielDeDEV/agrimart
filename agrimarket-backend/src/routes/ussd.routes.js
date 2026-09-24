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

/**
 * The same webhook with the shared secret in the path.
 *
 * Some gateways drop the query string when they call a callback, which makes
 * ?secret=… arrive empty and every dial fail with nothing to explain it. A
 * path segment always survives.
 *
 * Declared last on purpose: "/:secret" matches any single segment, so it must
 * come after /simulate and /menu or it would swallow them.
 */
router.post('/:secret', limiter.ussd, gatewayAuth, ctrl.gateway);
router.get('/:secret', limiter.ussd, gatewayAuth, ctrl.gateway);

module.exports = router;
