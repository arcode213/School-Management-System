const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee
} = require('../controllers/feeController');

router.use(protect);
router.use(authorize('Admin', 'Accountant'));

router.post('/bulk', addBulkFees);
router.get('/dues', getDues);
router.get('/student/:id', getStudentFees);

router.route('/')
  .get(getFees)
  .post(addFee);

router.route('/:id')
  .get(getFee)
  .put(updateFee)
  .delete(deleteFee);

module.exports = router;
