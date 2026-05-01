const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/',    ctrl.list);
router.get('/:id', ctrl.get);

router.post('/',         validate(ctrl.schemas.projectSchema), ctrl.create);
router.put('/:id',       requireRole('admin'), validate(ctrl.schemas.projectSchema), ctrl.update);
router.delete('/:id',    requireRole('admin'), ctrl.remove);

router.get('/:id/members',                 ctrl.listMembers);
router.post('/:id/members',                requireRole('admin'),
  validate(ctrl.schemas.memberSchema),     ctrl.addMember);
router.delete('/:id/members/:userId',      requireRole('admin'), ctrl.removeMember);

module.exports = router;
