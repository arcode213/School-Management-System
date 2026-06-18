// One-off maintenance script: FULL WIPE of the entire database.
// Drops every collection in the connected MongoDB database.
// Usage: node scripts/wipeData.js
//
// WARNING: This is irreversible. It removes ALL data including campuses,
// academic sessions, and users. Re-create an admin + campus + session afterwards.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');

dotenv.config({ path: path.join(__dirname, '../.env') });

const wipe = async () => {
  try {
    await connectDB();
    const db = mongoose.connection;
    console.log(`Connected to database: "${db.name}"`);

    const collections = await db.db.listCollections().toArray();
    if (collections.length === 0) {
      console.log('Database is already empty. Nothing to do.');
      process.exit(0);
    }

    console.log('\nCollections found (documents before wipe):');
    for (const c of collections) {
      const count = await db.db.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count}`);
    }

    console.log('\nDropping database...');
    await db.dropDatabase();
    console.log(`✅ Database "${db.name}" wiped. All collections removed.`);

    process.exit(0);
  } catch (err) {
    console.error('Wipe failed:', err.message);
    process.exit(1);
  }
};

wipe();
