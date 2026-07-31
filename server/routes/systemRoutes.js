const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getCampuses, createCampus, updateCampus, deleteCampus,
  getSessions, createSession, updateSession, deleteSession,
  resetData
} = require('../controllers/systemController');

router.use(protect);

router.route('/campuses')
  .get(getCampuses)
  .post(authorize('Admin'), createCampus);

router.route('/campuses/:id')
  .put(authorize('Admin'), updateCampus)
  .delete(authorize('Admin'), deleteCampus);

router.route('/sessions')
  .get(getSessions)
  .post(authorize('Admin'), createSession);

router.route('/sessions/:id')
  .put(authorize('Admin'), updateSession)
  .delete(authorize('Admin'), deleteSession);

// Irreversible bulk delete of all student/fee/employee/salary data. Admin only,
// and the request body must carry the exact confirmation phrase.
router.post('/reset-data', authorize('Admin'), resetData);

module.exports = router;
