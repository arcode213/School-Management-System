const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, postSalary, getSalaryHistory, bulkAddEmployees
} = require('../controllers/employeeController');

// Removed router-level authorize
router.use(protect);

router.route('/')
  .get(authorize('Admin', 'Administrator', 'Staff'), getEmployees)
  .post(authorize('Admin', 'Administrator', 'Staff'), addEmployee);

router.post('/bulk', authorize('Admin', 'Administrator', 'Staff'), bulkAddEmployees);

router.post('/salary', authorize('Admin', 'Administrator'), postSalary);

router.route('/:id')
  .get(authorize('Admin', 'Administrator', 'Staff'), getEmployee)
  .put(authorize('Admin', 'Administrator', 'Staff'), updateEmployee)
  .delete(authorize('Admin', 'Administrator'), deleteEmployee);

router.get('/:id/salary-history', authorize('Admin', 'Administrator'), getSalaryHistory);

module.exports = router;
