const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
} = require('../controllers/expenseController');

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(authorize('Admin', 'Administrator', 'Staff'), createExpense);

router.route('/:id')
  .put(authorize('Admin', 'Administrator', 'Staff'), updateExpense)
  .delete(authorize('Admin', 'Administrator'), deleteExpense);

module.exports = router;
