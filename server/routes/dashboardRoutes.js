const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
  getStats,
  getMonthlyFees,
  getClassDistribution,
  getFeeStatus,
  getRecentPayments,
} = require('../controllers/dashboardController');

router.use(protect);
router.use(requirePermission('dashboard', 'view'));

router.get('/stats', getStats);
router.get('/monthly-fees', getMonthlyFees);
router.get('/class-distribution', getClassDistribution);
router.get('/fee-status', getFeeStatus);
router.get('/recent-payments', getRecentPayments);

module.exports = router;
