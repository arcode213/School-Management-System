const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const targetSessionId = '6a48f425d7d082f9fe417747';

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in env.');
    }
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const FeeRecord = mongoose.model('FeeRecord', new mongoose.Schema({}, { strict: false }));
    const StudentAcademicRecord = mongoose.model('StudentAcademicRecord', new mongoose.Schema({}, { strict: false }));
    const FeeStructure = mongoose.model('FeeStructure', new mongoose.Schema({}, { strict: false }));
    const StudentFeeOverride = mongoose.model('StudentFeeOverride', new mongoose.Schema({}, { strict: false }));
    const AcademicSession = mongoose.model('AcademicSession', new mongoose.Schema({}, { strict: false }));

    console.log(`Starting cleanup for session: ${targetSessionId}...`);

    const feeRecordsDeleted = await FeeRecord.deleteMany({ academicSession: targetSessionId });
    console.log(`- Deleted ${feeRecordsDeleted.deletedCount} FeeRecords (challans)`);

    const academicRecordsDeleted = await StudentAcademicRecord.deleteMany({ academicSession: targetSessionId });
    console.log(`- Deleted ${academicRecordsDeleted.deletedCount} StudentAcademicRecords`);

    const feeStructuresDeleted = await FeeStructure.deleteMany({ academicSession: targetSessionId });
    console.log(`- Deleted ${feeStructuresDeleted.deletedCount} FeeStructures`);

    const studentFeeOverridesDeleted = await StudentFeeOverride.deleteMany({ academicSession: targetSessionId });
    console.log(`- Deleted ${studentFeeOverridesDeleted.deletedCount} StudentFeeOverrides`);

    const sessionDeleted = await AcademicSession.deleteOne({ _id: targetSessionId });
    console.log(`- Deleted AcademicSession: ${sessionDeleted.deletedCount}`);

    // Set the older session 2025-26 to active.
    const olderSessionId = '6a3fdb2a4e7037a52d0bd5d2';
    await AcademicSession.updateOne({ _id: olderSessionId }, { $set: { isActive: true } });
    console.log('- Marked session 2025-26 as active');

    console.log('✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
};

run();
