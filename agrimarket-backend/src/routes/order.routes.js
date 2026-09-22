const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/orderController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/', ctrl.list);
router.get('/stats', ctrl.stats);

router.post(
  '/',
  limiter.write,
  [
    body('listingId').notEmpty().withMessage('Choose a listing'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Enter how much you want to buy'),
    body('paymentMethod').optional().isIn(['momo', 'cash', 'bank', 'wallet']),
    body('deliveryMethod').optional().isIn(['pickup', 'delivery', 'transporter']),
  ],
  validate,
  ctrl.create
);

router.get('/:code', ctrl.getOne);

router.patch(
  '/:id/status',
  [
    body('status')
      .isIn(['accepted', 'rejected', 'paid', 'in_transit', 'delivered', 'completed', 'cancelled', 'disputed'])
      .withMessage('That is not a valid order status'),
  ],
  validate,
  ctrl.updateStatus
);

// Both take multipart, because they carry screenshots
router.post('/:id/payment', limiter.write, upload.evidenceImages, ctrl.recordPayment);
router.post('/:id/report', limiter.write, upload.evidenceImages, ctrl.report);

router.post(
  '/:id/review',
  [body('rating').isInt({ min: 1, max: 5 }).withMessage('Give a rating between 1 and 5')],
  validate,
  ctrl.review
);

module.exports = router;
