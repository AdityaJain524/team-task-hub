const router = require('express').Router();
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.post('/signup', validate(ctrl.schemas.signupSchema), ctrl.signup);
router.post('/login',  validate(ctrl.schemas.loginSchema),  ctrl.login);

// Stateless verification — pass a token in the body, no Authorization header needed
router.post('/verify', validate(ctrl.schemas.verifySchema), ctrl.verify);

// Authenticated check — returns current user if Bearer token is valid
router.get('/me', authenticate, ctrl.me);

module.exports = router;
