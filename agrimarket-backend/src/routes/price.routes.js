const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/priceController');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

// Public price board — objective 3 is only met if this needs no account
router.get('/', ctrl.latest);
router.get('/national', ctrl.national);
router.get('/compare', ctrl.compare);
router.get('/history/:produceId', ctrl.history);

// Personal price alerts
router.get('/alerts', protect, ctrl.listAlerts);
router.post(
  '/alerts',
  protect,
  [
    body('produceId').notEmpty().withMessage('Choose a produce'),
    body('targetPrice').isFloat({ gt: 0 }).withMessage('Enter your target price'),
    body('direction').optional().isIn(['above', 'below']),
  ],
  validate,
  ctrl.createAlert
);
router.delete('/alerts/:id', protect, ctrl.deleteAlert);
router.post('/digest/send', protect, ctrl.sendDigest);

// Recording prices is for admins and field agents
const priceEditors = [protect, restrictTo('admin', 'superadmin', 'agent')];

router.get('/admin/all', priceEditors, ctrl.adminList);
router.post(
  '/',
  priceEditors,
  [
    body('produceId').notEmpty().withMessage('Choose a produce'),
    body('marketId').notEmpty().withMessage('Choose a market'),
    body('minPrice').isFloat({ gt: 0 }).withMessage('Enter the lowest price seen'),
    body('maxPrice').isFloat({ gt: 0 }).withMessage('Enter the highest price seen'),
  ],
  validate,
  ctrl.create
);
router.post('/bulk', priceEditors, ctrl.bulkCreate);
router.patch('/:id', priceEditors, ctrl.update);
router.delete('/:id', protect, restrictTo('admin', 'superadmin'), ctrl.remove);

module.exports = router;
