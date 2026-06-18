const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google's Public DNS to resolve MongoDB SRV records
// This fixes the 'querySrv ECONNREFUSED' error caused by local ISP/router DNS issues.
dns.setServers(['8.8.8.8', '8.8.4.4']);
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
