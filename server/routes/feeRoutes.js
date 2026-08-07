const express = require('express');
const router = express.Router();
const { protect, requirePermission, requireAnyPermission } = require('../middleware/authMiddleware');
const { restrictFeeToScope, restrictStudentToScope } = require('../middleware/scopeMiddleware');
const {
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee
} = require('../controllers/feeController');

router.use(protect);

router.post('/bulk', requirePermission('fees', 'create'), addBulkFees);
router.get('/dues', requirePermission('dues', 'view'), getDues);
// Addressed by student id rather than campus, so the student has to be checked
// against the caller's scope as well — the controller then filters the records.
router.get('/student/:id', requirePermission('fees', 'view'), restrictStudentToScope, getStudentFees);

// The challan screen reads the same collection as the fee ledger, so either
// grant is enough to list or open a challan.
router.route('/')
  .get(requireAnyPermission(['fees', 'view'], ['challans', 'view']), getFees)
  .post(requireAnyPermission(['fees', 'create'], ['challans', 'create']), addFee);

// `restrictFeeToScope` keeps a campus-restricted account from reaching a challan
// belonging to a campus it was not given, even by direct id.
router.route('/:id')
  .get(requireAnyPermission(['fees', 'view'], ['challans', 'view']), restrictFeeToScope, getFee)
  // Recording a payment is an edit of the challan — this is the route the Record
  // Fee Receipt dialog posts to.
  .put(requirePermission('fees', 'edit'), restrictFeeToScope, updateFee)
  .delete(requirePermission('fees', 'delete'), restrictFeeToScope, deleteFee);

module.exports = router;
