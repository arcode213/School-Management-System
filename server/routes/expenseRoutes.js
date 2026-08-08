const express = require('express');
const router = express.Router();
const { protect, requirePermission, requireAnyPermission } = require('../middleware/authMiddleware');
const {
  validate, z, objectId, positiveMoney, pastOrToday, trimmed, PAYMENT_METHODS,
} = require('../middleware/validateMiddleware');
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  setExpenseStatus,
  getPendingExpenses,
} = require('../controllers/expenseController');

router.use(protect);

const expenseFields = {
  title: trimmed(140).min(1, 'Please give the transaction a title'),
  type: z.enum(['Income', 'Expense']).optional(),
  // Either the new category reference or the legacy string is acceptable.
  categoryRef: objectId.optional(),
  category: trimmed(40).optional(),
  subCategory: trimmed(80).optional(),
  amount: positiveMoney('Amount'),
  // A payment cannot be dated in the future — the money either moved or it did not.
  date: pastOrToday('Transaction date').optional(),
  description: trimmed(1000).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paidTo: trimmed(140).optional(),
  paidToEmployee: objectId.optional(),
  status: z.enum(['Pending', 'Approved']).optional(),
};

const createSchema = z.object(expenseFields);

// Every field optional on update, but the same rules apply to whatever is sent.
const updateSchema = z.object({
  ...Object.fromEntries(Object.entries(expenseFields).map(([k, v]) => [k, v.optional()])),
});

const statusSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { message: 'Status must be Approved or Rejected' }),
  rejectionReason: trimmed(300).optional(),
});

// Pending bills feed the accounts dashboard, so either permission opens it.
router.get(
  '/pending',
  requireAnyPermission(['accounts', 'view'], ['expenses', 'view']),
  getPendingExpenses
);

router.route('/')
  .get(requirePermission('expenses', 'view'), getExpenses)
  .post(requirePermission('expenses', 'create'), validate(createSchema), createExpense);

// Approving is an accounts responsibility, not an expense-entry one: the person
// who raises a bill should not be the one who signs it off.
router.patch(
  '/:id/status',
  requirePermission('accounts', 'edit'),
  validate(statusSchema),
  setExpenseStatus
);

router.route('/:id')
  .put(requirePermission('expenses', 'edit'), validate(updateSchema), updateExpense)
  .delete(requirePermission('expenses', 'delete'), deleteExpense);

module.exports = router;
