const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/offerController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiter');

router.use(protect);

router.get('/', ctrl.list);

router.post(
  '/',
  limiter.write,
  [
    body('listingId').notEmpty().withMessage('Choose a listing'),
    body('offerPrice').isFloat({ gt: 0 }).withMessage('Enter your offer price'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Enter the quantity you want'),
  ],
  validate,
  ctrl.create
);

router.patch(
  '/:id',
  [body('action').isIn(['accept', 'reject', 'counter', 'withdraw']).withMessage('Choose accept, reject, counter or withdraw')],
  validate,
  ctrl.respond
);

router.post('/:id/accept-counter', ctrl.acceptCounter);

module.exports = router;
