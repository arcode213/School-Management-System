const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      campus: user.campus, // needed so the client can scope campus-bound users
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
};

// @desc    Seed an admin user (run once)
// @route   POST /api/auth/seed
// @access  Public (disable in production)
const seedAdmin = async (req, res) => {
  try {
    // Never expose the one-click admin seeder in production. Use the
    // `scripts/seedAdmin.js` CLI script for the initial live setup instead.
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Seeding is disabled in production' });
    }

    const exists = await User.findOne({ email: 'admin@school.com' });
    if (exists) {
      return res.status(400).json({ message: 'Admin already seeded' });
    }
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@school.com',
      password: 'admin123',
      role: 'Admin',
    });
    res.status(201).json({ message: 'Admin created', email: admin.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { login, getMe, seedAdmin };
