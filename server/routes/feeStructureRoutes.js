const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getFeeStructures, saveFeeStructure, getOverrides, saveOverride, deleteOverride, rolloverFeeStructure } = require('../controllers/feeStructureController');

router.use(protect);

router.route('/')
  .get(requirePermission('feeStructures', 'view'), getFeeStructures)
  .post(requirePermission('feeStructures', 'edit'), saveFeeStructure);

router.route('/rollover')
  .post(requirePermission('feeStructures', 'create'), rolloverFeeStructure);

router.route('/overrides')
  .get(requirePermission('feeStructures', 'view'), getOverrides)
  .post(requirePermission('feeStructures', 'edit'), saveOverride);

router.route('/overrides/:id')
  .delete(requirePermission('feeStructures', 'delete'), deleteOverride);

module.exports = router;
