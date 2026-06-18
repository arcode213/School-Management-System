const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getFeeStructures, saveFeeStructure, getOverrides, saveOverride, deleteOverride } = require('../controllers/feeStructureController');

router.use(protect);
router.use(authorize('Admin', 'Accountant'));

router.route('/')
  .get(getFeeStructures)
  .post(saveFeeStructure);

router.route('/overrides')
  .get(getOverrides)
  .post(saveOverride);

router.route('/overrides/:id')
  .delete(deleteOverride);

module.exports = router;
