// One-off maintenance script: clear STUDENT DATA and CHALLANS only.
//
// Usage:
//   node scripts/clearStudents.js          -> dry run, just reports the counts
//   node scripts/clearStudents.js --yes    -> actually deletes
//
// WARNING: with --yes this is irreversible and no backup is taken.
//
// DELETED:
//   students              - the student master records
//   studentacademicrecords- their per-session enrolment (class, section, roll no)
//   feerecords            - every challan, paid or unpaid
//   studentfeeoverrides   - per-student fee exceptions (meaningless without students)
//
// KEPT: users, campuses, academicsessions, feestructures, employees, salaryrecords.
// So you can log straight back in and start enrolling students again.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Targeted by raw collection name rather than through the models, so a collection
// that does not exist is simply reported as 0 instead of throwing.
const TARGETS = [
  { name: 'students',               label: 'Students' },
  { name: 'studentacademicrecords', label: 'Student academic records' },
  { name: 'feerecords',             label: 'Challans (fee records)' },
  { name: 'studentfeeoverrides',    label: 'Student fee overrides' },
];

// Note: the Campus model's collection really is "campus" — Mongoose's pluralizer
// leaves it alone — so do not "correct" this to "campuses".
const KEPT = ['users', 'campus', 'academicsessions', 'feestructures', 'employees', 'salaryrecords'];

const run = async () => {
  const confirmed = process.argv.includes('--yes');

  await connectDB();
  const db = mongoose.connection;
  const existing = (await db.db.listCollections().toArray()).map(c => c.name);

  console.log(`\nDatabase : "${db.name}"`);
  console.log(`Host     : ${db.host}`);
  console.log(`Mode     : ${confirmed ? 'DELETE' : 'DRY RUN (pass --yes to delete)'}\n`);

  console.log('To be cleared:');
  for (const t of TARGETS) {
    const count = existing.includes(t.name) ? await db.db.collection(t.name).countDocuments() : 0;
    t.before = count;
    console.log(`  ${t.label.padEnd(26)} ${count}`);
  }

  console.log('\nTo be kept:');
  for (const name of KEPT) {
    const count = existing.includes(name) ? await db.db.collection(name).countDocuments() : 0;
    console.log(`  ${name.padEnd(26)} ${count}`);
  }

  // Anything the two lists above do not account for. Shown so a collection that
  // Mongoose pluralized unexpectedly can never be silently left behind.
  const accounted = new Set([...TARGETS.map(t => t.name), ...KEPT]);
  const others = existing.filter(n => !accounted.has(n));
  if (others.length) {
    console.log('\nOther collections present (NOT touched):');
    for (const name of others) {
      console.log(`  ${name.padEnd(26)} ${await db.db.collection(name).countDocuments()}`);
    }
  }

  if (!confirmed) {
    console.log('\nNothing deleted. Re-run with --yes to clear the collections listed above.');
    return process.exit(0);
  }

  console.log('\nDeleting...');
  for (const t of TARGETS) {
    if (!existing.includes(t.name)) {
      console.log(`  ${t.label.padEnd(26)} - collection does not exist, skipped`);
      continue;
    }
    const { deletedCount } = await db.db.collection(t.name).deleteMany({});
    const left = await db.db.collection(t.name).countDocuments();
    console.log(`  ${t.label.padEnd(26)} deleted ${deletedCount}, remaining ${left}`);
  }

  console.log('\n✅ Student records and challans cleared. Your login, campus, session and fee structures are untouched.');
  process.exit(0);
};

run().catch(err => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
