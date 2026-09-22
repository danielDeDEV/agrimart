const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/messageController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/conversations', ctrl.conversations);
router.post(
  '/conversations',
  [body('listingId').notEmpty().withMessage('Choose a listing to discuss')],
  validate,
  ctrl.startConversation
);
router.get('/conversations/:id', ctrl.messages);
router.post(
  '/conversations/:id',
  [body('body').trim().notEmpty().withMessage('Type a message')],
  validate,
  ctrl.send
);

module.exports = router;
