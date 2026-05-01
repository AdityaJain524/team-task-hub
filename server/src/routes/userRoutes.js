const router = require('express').Router();
const ctrl = require('../controllers/userController');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.list);
router.post('/', validate(ctrl.schemas.createUserSchema), ctrl.create);
router.patch('/:id/role', ctrl.updateRole);

module.exports = router;
