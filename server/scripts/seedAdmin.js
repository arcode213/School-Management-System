// One-off script: create the default admin login.
// Mirrors POST /api/auth/seed. The User pre-save hook hashes the password.
// Usage: node scripts/seedAdmin.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
  try {
    await connectDB();

    const exists = await User.findOne({ email: 'admin@school.com' });
    if (exists) {
      console.log('Admin already exists: admin@school.com');
      process.exit(0);
    }

    await User.create({
      name: 'Super Admin',
      email: 'admin@school.com',
      password: 'admin123',
      role: 'Admin',
    });

    console.log('✅ Admin created');
    console.log('   Email:    admin@school.com');
    console.log('   Password: admin123');
    process.exit(0);
  } catch (err) {
    console.error('Seeding admin failed:', err.message);
    process.exit(1);
  }
};

seedAdmin();
