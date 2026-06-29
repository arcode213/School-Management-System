const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getFinancialReport } = require('../controllers/reportController');

router.use(protect);
router.use(authorize('Admin', 'Administrator'));

router.get('/financial', getFinancialReport);

module.exports = router;
