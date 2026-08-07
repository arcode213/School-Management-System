const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getFinancialReport } = require('../controllers/reportController');

router.use(protect);

router.get('/financial', requirePermission('reports', 'view'), getFinancialReport);

module.exports = router;
