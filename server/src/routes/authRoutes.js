const router = require('express').Router();
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.post('/signup', validate(ctrl.schemas.signupSchema), ctrl.signup);
router.post('/login',  validate(ctrl.schemas.loginSchema),  ctrl.login);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
