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
  .post(authorize('Admin', 'Accountant'), addStudent);

router.route('/:id')
  .get(getStudent)
  .put(authorize('Admin', 'Accountant'), updateStudent)
  .delete(authorize('Admin'), deleteStudent);

module.exports = router;
