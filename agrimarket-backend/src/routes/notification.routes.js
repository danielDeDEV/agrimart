const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);
router.delete('/', ctrl.clearAll);

module.exports = router;
