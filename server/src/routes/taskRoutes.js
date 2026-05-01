const router = require('express').Router();
const ctrl = require('../controllers/taskController');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard',          ctrl.dashboard);
router.get('/mine',               ctrl.myTasks);
router.get('/project/:projectId', ctrl.listByProject);

router.post('/',           requireRole('admin'), validate(ctrl.schemas.createSchema), ctrl.create);
router.put('/:id',         requireRole('admin'), validate(ctrl.schemas.updateSchema), ctrl.update);
router.delete('/:id',      requireRole('admin'), ctrl.remove);

router.patch('/:id/status', validate(ctrl.schemas.statusSchema), ctrl.updateStatus);

module.exports = router;
