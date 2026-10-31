const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google's Public DNS to resolve MongoDB SRV records
// This fixes the 'querySrv ECONNREFUSED' error caused by local ISP/router DNS issues.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore safely if DNS override is not permitted in runtime environment
}

// Global cache to maintain a single reusable connection across serverless function invocations
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected and ready, return existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection is in progress, await it
  if (cached.promise && mongoose.connection.readyState === 2) {
    cached.conn = await cached.promise;
    return cached.conn;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  // Connection options optimized for serverless (Vercel) & MongoDB Atlas M0
  const opts = {
    // Limit pool size per container instance so multiple lambdas do not exceed the M0 500-conn cap
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 10000,            // Close idle sockets after 10s to free Atlas connection slots
    serverSelectionTimeoutMS: 5000,  // Fast fail instead of hanging if Atlas is unreachable
    socketTimeoutMS: 45000,
  };

  cached.promise = mongoose.connect(uri, opts).then((m) => {
    console.log('✅ MongoDB connected successfully');
    return m;
  });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

module.exports = connectDB;
