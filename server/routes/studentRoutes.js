const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  addStudent, getStudents, getStudent, updateStudent, deleteStudent, getClasses,
} = require('../controllers/studentController');
const { promoteStudents } = require('../controllers/promotionController');

router.use(protect);

router.get('/classes', getClasses);
router.post('/promote', authorize('Admin'), promoteStudents);

router.route('/')
  .get(getStudents)
  .post(authorize('Admin', 'Administrator', 'Staff'), addStudent);

router.route('/:id')
  .get(getStudent)
  .put(authorize('Admin', 'Administrator', 'Staff'), updateStudent)
  .delete(authorize('Admin', 'Administrator'), deleteStudent);

module.exports = router;
