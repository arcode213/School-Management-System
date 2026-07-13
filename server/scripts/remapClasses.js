// One-time class remap to match the new class list (Nursery, KG1, KG2, 1-8).
//
// - Renames old classes to their new names (KG -> KG1).
// - Deactivates fee structures for classes the school no longer offers (9-12),
//   which have no students. Deactivation (isActive:false) is reversible and
//   simply hides them from the UI, rather than deleting the fee data.
//
// Safe to re-run: renames only touch the old names, and deactivation is idempotent.
//
//   node scripts/remapClasses.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const FeeStructure = require('../models/FeeStructure');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CLASS_RENAMES = { KG: 'KG1' };      // old className -> new className
const DEACTIVATE_CLASSES = ['9', '10', '11', '12']; // removed from the school

(async () => {
  try {
    await connectDB();
    console.log('--- Class remap starting ---');

    // 1. Rename student academic records.
    for (const [oldName, newName] of Object.entries(CLASS_RENAMES)) {
      const res = await StudentAcademicRecord.updateMany(
        { className: oldName, isDeleted: false },
        { $set: { className: newName } }
      );
      console.log(`StudentAcademicRecord: "${oldName}" -> "${newName}" (${res.modifiedCount} updated)`);
    }

    // 2. Rename fee structures (guarding the unique campus+session+class index:
    //    only rename when no structure already exists under the new name).
    for (const [oldName, newName] of Object.entries(CLASS_RENAMES)) {
      const olds = await FeeStructure.find({ className: oldName });
      let renamed = 0, skipped = 0;
      for (const fs of olds) {
        const clash = await FeeStructure.findOne({
          campus: fs.campus, academicSession: fs.academicSession, className: newName,
        });
        if (clash) { skipped++; continue; }
        fs.className = newName;
        await fs.save();
        renamed++;
      }
      console.log(`FeeStructure: "${oldName}" -> "${newName}" (${renamed} renamed, ${skipped} skipped due to existing "${newName}")`);
    }

    // 3. Deactivate fee structures for removed classes.
    const deact = await FeeStructure.updateMany(
      { className: { $in: DEACTIVATE_CLASSES }, isActive: true },
      { $set: { isActive: false } }
    );
    console.log(`FeeStructure: deactivated classes ${DEACTIVATE_CLASSES.join(', ')} (${deact.modifiedCount} hidden)`);

    console.log('--- Class remap complete ---');
    process.exit(0);
  } catch (err) {
    console.error('Remap failed:', err.message);
    process.exit(1);
  }
})();
