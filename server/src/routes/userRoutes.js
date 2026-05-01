const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin'), ctrl.list);

module.exports = router;
