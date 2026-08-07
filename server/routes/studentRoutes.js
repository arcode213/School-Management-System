const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { restrictStudentToScope } = require('../middleware/scopeMiddleware');
const {
  addStudent, getStudents, getStudent, updateStudent, deleteStudent, getClasses, bulkAddStudents
} = require('../controllers/studentController');
const { promoteStudents } = require('../controllers/promotionController');

router.use(protect);

// The class list feeds filter dropdowns all over the app, so it only needs a
// logged-in user rather than a specific module grant.
router.get('/classes', getClasses);

router.post('/promote', requirePermission('promotions', 'edit'), promoteStudents);

router.route('/')
  .get(requirePermission('students', 'view'), getStudents)
  .post(requirePermission('students', 'create'), addStudent);

router.post('/bulk', requirePermission('students', 'create'), bulkAddStudents);

router.route('/:id')
  .get(requirePermission('students', 'view'), restrictStudentToScope, getStudent)
  .put(requirePermission('students', 'edit'), restrictStudentToScope, updateStudent)
  .delete(requirePermission('students', 'delete'), restrictStudentToScope, deleteStudent);

module.exports = router;
