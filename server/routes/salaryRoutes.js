const express = require('express');
const router = express.Router();
const { protect, requirePermission, requireAnyPermission } = require('../middleware/authMiddleware');
const {
  validate, z, objectId, money, positiveMoney, pastOrToday, monthKey, trimmed, SALARY_METHODS,
} = require('../middleware/validateMiddleware');
const {
  getSalarySheet,
  paySalary,
  getSalaryRecord,
  updateSalaryRecord,
  getAdvances,
  createAdvance,
  cancelAdvance,
} = require('../controllers/salaryController');
const { exportSalarySheet } = require('../controllers/exportController');

router.use(protect);

const paySchema = z.object({
  employee: objectId,
  month: monthKey('Month'),
  baseSalary: money('Base salary').optional(),
  allowances: money('Allowances').optional(),
  allowanceDays: z.coerce.number().int().min(0).max(31).optional(),
  absenceDeduction: money('Absence deduction').optional(),
  taxDeduction: money('Tax deduction').optional(),
  securityDeposit: money('Security deposit').optional(),
  otherDeduction: money('Other deduction').optional(),
  advanceDeduction: money('Advance deduction').optional(),
  absentDays: z.coerce.number().int().min(0, 'Absent days cannot be negative').max(31).optional(),
  attendanceBonus: money('Attendance bonus').optional(),
  // Omitting this pays the full net salary; sending a smaller figure part-pays.
  amountPaid: money('Amount paid').optional(),
  paymentMethod: z.enum(SALARY_METHODS).optional(),
  paymentDate: pastOrToday('Payment date').optional(),
  remarks: trimmed(300).optional(),
  recoverAdvances: z.boolean().optional(),
});

const updateSalarySchema = z.object({
  baseSalary: money('Base salary').optional(),
  allowances: money('Allowances').optional(),
  allowanceDays: z.coerce.number().int().min(0).max(31).optional(),
  absenceDeduction: money('Absence deduction').optional(),
  taxDeduction: money('Tax deduction').optional(),
  securityDeposit: money('Security deposit').optional(),
  otherDeduction: money('Other deduction').optional(),
  advanceDeduction: money('Advance deduction').optional(),
  absentDays: z.coerce.number().int().min(0, 'Absent days cannot be negative').max(31).optional(),
  attendanceBonus: money('Attendance bonus').optional(),
  amountPaid: money('Amount paid').optional(),
  paymentMethod: z.enum(SALARY_METHODS).optional(),
  paymentDate: pastOrToday('Payment date').optional(),
  status: z.enum(['Paid', 'Partial', 'Pending']).optional(),
  remarks: trimmed(300).optional(),
});

const advanceSchema = z.object({
  employee: objectId,
  amount: positiveMoney('Advance amount'),
  dateGiven: pastOrToday('Date given').optional(),
  reason: trimmed(300).optional(),
  recoverFromMonth: monthKey('Recover from month'),
  monthlyInstalment: money('Monthly instalment').optional(),
});

// ── Advances. Declared before '/:id' so 'advances' is not read as an id. ──
router.route('/advances')
  .get(requireAnyPermission(['accounts', 'view'], ['salaries', 'view']), getAdvances)
  .post(requirePermission('accounts', 'create'), validate(advanceSchema), createAdvance);

router.delete('/advances/:id', requirePermission('accounts', 'delete'), cancelAdvance);

// ── Sheet and payment ────────────────────────────────────────────────────────
router.get('/exports/sheet', requireAnyPermission(['accounts', 'view'], ['salaries', 'view']), exportSalarySheet);
router.get('/sheet', requireAnyPermission(['accounts', 'view'], ['salaries', 'view']), getSalarySheet);

// Paying a salary moves money and posts to the ledger, so it needs the salary
// grant the API has always checked for this.
router.post('/pay', requirePermission('salaries', 'create'), validate(paySchema), paySalary);

router.route('/:id')
  .get(requireAnyPermission(['accounts', 'view'], ['salaries', 'view']), getSalaryRecord)
  .put(requireAnyPermission(['salaries', 'edit'], ['salaries', 'create']), validate(updateSalarySchema), updateSalaryRecord);

module.exports = router;
