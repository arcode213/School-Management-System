const express = require('express');
const router = express.Router();
const { protect, requirePermission, requireAnyPermission } = require('../middleware/authMiddleware');
const { validate, z, trimmed } = require('../middleware/validateMiddleware');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/expenseCategoryController');

router.use(protect);

const createSchema = z.object({
  name: trimmed(60).min(1, 'Category name is required'),
  type: z.enum(['Expense', 'Income']).optional(),
  suggested: z.array(trimmed(60)).optional(),
});

const updateSchema = z.object({
  name: trimmed(60).min(1, 'Category name is required').optional(),
  suggested: z.array(trimmed(60)).optional(),
  isActive: z.boolean().optional(),
});

router.route('/')
  // The expense entry form needs the category list, so anyone who may record an
  // expense must be able to read it — not only the accounts role.
  .get(requireAnyPermission(['accounts', 'view'], ['expenses', 'view']), getCategories)
  .post(requirePermission('accounts', 'create'), validate(createSchema), createCategory);

router.route('/:id')
  .put(requirePermission('accounts', 'edit'), validate(updateSchema), updateCategory)
  .delete(requirePermission('accounts', 'delete'), deleteCategory);

module.exports = router;
