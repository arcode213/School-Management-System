const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, postSalary, getSalaryHistory
} = require('../controllers/employeeController');

// All employee routes are for Admin only
router.use(protect);
router.use(authorize('Admin'));

router.route('/')
  .get(getEmployees)
  .post(addEmployee);

router.post('/salary', postSalary);

router.route('/:id')
  .get(getEmployee)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.get('/:id/salary-history', getSalaryHistory);

module.exports = router;
