const express = require('express');
const router = express.Router();
const { login, getMe, seedAdmin } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/seed', seedAdmin); // Disable after first use

module.exports = router;
