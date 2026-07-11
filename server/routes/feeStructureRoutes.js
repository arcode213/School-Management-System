const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getFeeStructures, saveFeeStructure, getOverrides, saveOverride, deleteOverride, rolloverFeeStructure } = require('../controllers/feeStructureController');

router.use(protect);
router.route('/')
  .get(authorize('Admin', 'Administrator', 'Staff'), getFeeStructures)
  .post(authorize('Admin', 'Administrator', 'Staff'), saveFeeStructure);

router.route('/rollover')
  .post(authorize('Admin', 'Administrator'), rolloverFeeStructure);

router.route('/overrides')
  .get(authorize('Admin', 'Administrator', 'Staff'), getOverrides)
  .post(authorize('Admin', 'Administrator', 'Staff'), saveOverride);

router.route('/overrides/:id')
  .delete(authorize('Admin', 'Administrator'), deleteOverride);

module.exports = router;
