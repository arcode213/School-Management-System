const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getStats,
  getMonthlyFees,
  getClassDistribution,
  getFeeStatus,
  getRecentPayments,
} = require('../controllers/dashboardController');

router.use(protect); // All dashboard routes require auth

router.get('/stats', getStats);
router.get('/monthly-fees', getMonthlyFees);
router.get('/class-distribution', getClassDistribution);
router.get('/fee-status', getFeeStatus);
router.get('/recent-payments', getRecentPayments);

module.exports = router;
