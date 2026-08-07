const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { restrictEmployeeToScope } = require('../middleware/scopeMiddleware');
const {
  addEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, postSalary, getSalaryHistory, bulkAddEmployees
} = require('../controllers/employeeController');

router.use(protect);

router.route('/')
  .get(requirePermission('employees', 'view'), getEmployees)
  .post(requirePermission('employees', 'create'), addEmployee);

router.post('/bulk', requirePermission('employees', 'create'), bulkAddEmployees);

// Salaries are their own module so pay figures can be kept from staff who are
// otherwise allowed to manage employee records.
router.post('/salary', requirePermission('salaries', 'create'), postSalary);

router.route('/:id')
  .get(requirePermission('employees', 'view'), restrictEmployeeToScope, getEmployee)
  .put(requirePermission('employees', 'edit'), restrictEmployeeToScope, updateEmployee)
  .delete(requirePermission('employees', 'delete'), restrictEmployeeToScope, deleteEmployee);

router.get('/:id/salary-history', requirePermission('salaries', 'view'), restrictEmployeeToScope, getSalaryHistory);

module.exports = router;
