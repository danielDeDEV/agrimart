const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/me/dashboard', protect, ctrl.dashboard);
router.get('/me/transactions', protect, ctrl.transactions);
router.get('/me/reviews', protect, ctrl.myReviews);
router.patch('/me', protect, ctrl.updateProfile);
router.post('/me/avatar', protect, upload.avatar, ctrl.uploadAvatar);
router.post('/me/withdraw', protect, ctrl.withdraw);

// Public seller profile, addressed by uuid so ids are not enumerable
router.get('/:uuid', ctrl.publicProfile);

module.exports = router;
