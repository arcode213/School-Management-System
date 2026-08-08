const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
  validate, z, objectId, positiveMoney, monthKey, trimmed, PAYMENT_METHODS,
} = require('../middleware/validateMiddleware');
const {
  getRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runGeneration,
} = require('../controllers/recurringExpenseController');

router.use(protect);

const fields = {
  title: trimmed(140).min(1, 'Please give the recurring bill a title'),
  categoryRef: objectId,
  subCategory: trimmed(80).optional(),
  amount: positiveMoney('Amount'),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paidTo: trimmed(140).optional(),
  description: trimmed(1000).optional(),
  // Capped at 28 so a bill can never skip a February.
  dayOfMonth: z.coerce.number().int().min(1, 'Day must be between 1 and 28')
    .max(28, 'Day must be 28 or lower, so every month has it').optional(),
  startMonth: monthKey('Start month').optional(),
  endMonth: monthKey('End month').nullable().optional(),
  isActive: z.boolean().optional(),
};

const createSchema = z.object(fields).refine(
  (d) => !d.endMonth || !d.startMonth || d.endMonth >= d.startMonth,
  { message: 'End month cannot be before the start month', path: ['endMonth'] }
);

const updateSchema = z.object(
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]))
);

router.post('/generate', requirePermission('accounts', 'create'), runGeneration);

router.route('/')
  .get(requirePermission('accounts', 'view'), getRecurring)
  .post(requirePermission('accounts', 'create'), validate(createSchema), createRecurring);

router.route('/:id')
  .put(requirePermission('accounts', 'edit'), validate(updateSchema), updateRecurring)
  .delete(requirePermission('accounts', 'delete'), deleteRecurring);

module.exports = router;
