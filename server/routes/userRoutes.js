const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getPermissionCatalog
} = require('../controllers/userController');

router.use(protect);
// Accounts, permissions and campus/session scopes belong to the main admin alone.
// This stays a role check on purpose: it must not be something one account can be
// granted, or a restricted user could widen their own access.
router.use(authorize('Admin'));

// The module/action catalogue the permission editor renders its checkboxes from.
router.get('/permission-catalog', getPermissionCatalog);

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;
