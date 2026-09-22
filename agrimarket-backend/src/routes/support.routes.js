const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/supportController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const limiter = require('../middleware/rateLimiter');

router.post(
  '/',
  limiter.write,
  optionalAuth,
  // Screenshots may come with the message, so read multipart before validating
  upload.evidenceImages,
  [
    body('subject').trim().isLength({ min: 3 }).withMessage('Give your message a subject'),
    body('message').trim().isLength({ min: 10 }).withMessage('Tell us a little more so we can help'),
  ],
  validate,
  ctrl.create
);

router.get('/mine', protect, ctrl.mine);

module.exports = router;
