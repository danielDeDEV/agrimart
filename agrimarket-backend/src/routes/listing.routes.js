const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/listingController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

// Public browsing — optionalAuth so we can flag the viewer's saved listings
router.get('/', optionalAuth, ctrl.list);
router.get('/featured', ctrl.featured);

// Signed-in collections must be declared before the /:code catch-all
router.get('/mine', protect, ctrl.mine);
router.get('/favorites', protect, ctrl.favorites);

router.post(
  '/',
  protect,
  limiter.write,
  upload.listingImages,
  [
    body('produceId').notEmpty().withMessage('Choose what you are selling'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Enter how much you have'),
    body('pricePerUnit').isFloat({ gt: 0 }).withMessage('Enter your price per unit'),
    body('unit').optional().trim().notEmpty(),
  ],
  validate,
  ctrl.create
);

router.get('/:code', optionalAuth, ctrl.getOne);
router.patch('/:id', protect, upload.listingImages, ctrl.update);
router.delete('/:id', protect, ctrl.remove);
router.post('/:id/favorite', protect, ctrl.toggleFavorite);
router.get('/:id/offers', protect, ctrl.listingOffers);

module.exports = router;
