const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { validate, z, monthKey, trimmed } = require('../middleware/validateMiddleware');
const {
  getLedger,
  getSummary,
  closeMonth,
  reopenMonth,
  getClosedMonths,
} = require('../controllers/accountsController');
const { exportPnl, exportExpenses } = require('../controllers/exportController');

router.use(protect);

const closeSchema = z.object({
  month: monthKey('Month'),
  notes: trimmed(500).optional(),
});

const reopenSchema = z.object({
  month: monthKey('Month'),
  reason: trimmed(500).min(1, 'Please say why the month is being reopened'),
});

// Downloads. Reading a report is the same right as reading the screen it came
// from, so these sit behind `view` rather than a grant of their own.
router.get('/exports/pnl', requirePermission('accounts', 'view'), exportPnl);
router.get('/exports/expenses', requirePermission('accounts', 'view'), exportExpenses);

router.get('/ledger', requirePermission('accounts', 'view'), getLedger);
router.get('/summary', requirePermission('accounts', 'view'), getSummary);
router.get('/closed-months', requirePermission('accounts', 'view'), getClosedMonths);

// Closing and reopening are the module's most consequential actions — they
// freeze and unfreeze a month's books — so both sit behind `edit`.
router.post('/close-month', requirePermission('accounts', 'edit'), validate(closeSchema), closeMonth);
router.post('/reopen-month', requirePermission('accounts', 'edit'), validate(reopenSchema), reopenMonth);

module.exports = router;
