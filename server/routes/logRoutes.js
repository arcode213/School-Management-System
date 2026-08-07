const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getLogs, getLogMeta, getEntityHistory } = require('../controllers/logController');

router.use(protect);
// The audit trail is the main admin's alone, and deliberately not a grantable
// permission: an account that could be given sight of the log could be given
// sight of everyone's activity, and one that could be given power over it could
// cover its own tracks. There is no write route here at all — entries are made
// by the audit middleware and are never edited or deleted through the API.
router.use(authorize('Admin'));

router.get('/', getLogs);
router.get('/meta', getLogMeta);
router.get('/entity/:entity/:id', getEntityHistory);

module.exports = router;
