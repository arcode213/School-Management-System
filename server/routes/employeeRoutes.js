const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, postSalary, getSalaryHistory
} = require('../controllers/employeeController');

// Removed router-level authorize

router.route('/')
  .get(authorize('Admin', 'Administrator', 'Staff'), getEmployees)
  .post(authorize('Admin', 'Administrator', 'Staff'), addEmployee);

router.post('/salary', authorize('Admin', 'Administrator'), postSalary);

router.route('/:id')
  .get(authorize('Admin', 'Administrator', 'Staff'), getEmployee)
  .put(authorize('Admin', 'Administrator', 'Staff'), updateEmployee)
  .delete(authorize('Admin', 'Administrator'), deleteEmployee);

router.get('/:id/salary-history', authorize('Admin', 'Administrator'), getSalaryHistory);

module.exports = router;
