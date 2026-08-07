const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
} = require('../controllers/expenseController');

router.use(protect);

router.route('/')
  .get(requirePermission('expenses', 'view'), getExpenses)
  .post(requirePermission('expenses', 'create'), createExpense);

router.route('/:id')
  .put(requirePermission('expenses', 'edit'), updateExpense)
  .delete(requirePermission('expenses', 'delete'), deleteExpense);

module.exports = router;
