const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee
} = require('../controllers/feeController');

router.use(protect);
router.post('/bulk', authorize('Admin', 'Administrator', 'Staff'), addBulkFees);
router.get('/dues', authorize('Admin', 'Administrator'), getDues);
router.get('/student/:id', authorize('Admin', 'Administrator', 'Staff'), getStudentFees);

router.route('/')
  .get(authorize('Admin', 'Administrator', 'Staff'), getFees)
  .post(authorize('Admin', 'Administrator', 'Staff'), addFee);

router.route('/:id')
  .get(authorize('Admin', 'Administrator', 'Staff'), getFee)
  .put(authorize('Admin', 'Administrator', 'Staff'), updateFee)
  .delete(authorize('Admin', 'Administrator'), deleteFee);

module.exports = router;
