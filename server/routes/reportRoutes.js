const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getFinancialReport } = require('../controllers/reportController');

router.use(protect);
router.use(authorize('Admin')); // Only Admin can view financial reports

router.get('/financial', getFinancialReport);

module.exports = router;
