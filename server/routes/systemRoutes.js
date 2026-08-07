const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/authMiddleware');
const {
  getCampuses, createCampus, updateCampus, deleteCampus,
  getSessions, createSession, updateSession, deleteSession,
  resetData
} = require('../controllers/systemController');

router.use(protect);

// Reading the campus / session lists is open to any logged-in user — the header
// switcher cannot work without it. The controllers narrow each list to what the
// account is scoped to, so an unpermitted campus never appears in the first place.
router.route('/campuses')
  .get(getCampuses)
  .post(requirePermission('settings', 'create'), createCampus);

router.route('/campuses/:id')
  .put(requirePermission('settings', 'edit'), updateCampus)
  .delete(requirePermission('settings', 'delete'), deleteCampus);

router.route('/sessions')
  .get(getSessions)
  .post(requirePermission('settings', 'create'), createSession);

router.route('/sessions/:id')
  .put(requirePermission('settings', 'edit'), updateSession)
  .delete(requirePermission('settings', 'delete'), deleteSession);

// Irreversible bulk delete of all student/fee/employee/salary data. Admin only —
// and deliberately not a grantable permission — and the request body must carry
// the exact confirmation phrase.
router.post('/reset-data', authorize('Admin'), resetData);

module.exports = router;
