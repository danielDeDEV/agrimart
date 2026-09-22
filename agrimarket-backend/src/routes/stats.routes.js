const router = require('express').Router();
const ctrl = require('../controllers/statsController');

router.get('/public', ctrl.publicStats);
router.get('/market-snapshot', ctrl.marketSnapshot);

module.exports = router;
