const mongoose = require('mongoose');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const AcademicSession = require('../models/AcademicSession');

// @desc    Promote students to a new session/class
// @route   POST /api/students/promote
const promoteStudents = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { currentCampus, currentSession } = req;
    const { targetSessionId, promotions } = req.body;
    
    // promotions should be an array of: { studentId, targetClass, targetSection, promotionStatus (Promoted/Failed/Graduated) }

    if (!currentCampus || !currentSession || !targetSessionId) {
      throw new Error('Current Campus, Current Session, and Target Session are required.');
    }

    if (!Array.isArray(promotions) || promotions.length === 0) {
      throw new Error('No promotions provided.');
    }

    const targetSession = await AcademicSession.findById(targetSessionId);
    if (!targetSession) {
      throw new Error('Target Academic Session not found.');
    }

    const newRecords = [];
    let promotedCount = 0;
    let skippedCount = 0;

    for (const promo of promotions) {
      // Find the current academic record
      const currentRecord = await StudentAcademicRecord.findOne({
        student: promo.studentId,
        academicSession: currentSession,
        campus: currentCampus,
        isDeleted: false
      }).session(session);

      if (!currentRecord) {
        throw new Error(`Academic record not found for student ${promo.studentId} in current session.`);
      }

      // Only Active students are eligible for promotion. Skip any record that has
      // already left, graduated, or was otherwise deactivated so it is never
      // carried into the target session (defense-in-depth alongside the UI filter).
      if (currentRecord.status !== 'Active') {
        skippedCount++;
        continue;
      }

      // Update current record's promotion status
      currentRecord.promotionStatus = promo.promotionStatus;
      await currentRecord.save({ session });
      promotedCount++;

      // Create new record for the target session if not graduated
      if (promo.promotionStatus !== 'Graduated') {
        // Guard against duplicates: re-running a promotion for the same student
        // into the same target session must not create a second record.
        const alreadyPromoted = await StudentAcademicRecord.findOne({
          student: promo.studentId,
          academicSession: targetSessionId,
          campus: currentCampus,
          isDeleted: false
        }).session(session);

        if (!alreadyPromoted) {
          const nextRecord = new StudentAcademicRecord({
            student: promo.studentId,
            academicSession: targetSessionId,
            campus: currentCampus,
            className: promo.targetClass || currentRecord.className,
            section: promo.targetSection || currentRecord.section,
            status: 'Active',
            feeStructure: currentRecord.feeStructure, // carry over or update later
            admissionDate: currentRecord.admissionDate
          });
          newRecords.push(nextRecord);
        }
      } else {
        // If graduated, we can update the main Student model status (optional)
        const Student = require('../models/Student');
        await Student.findByIdAndUpdate(promo.studentId, { status: 'Graduated' }, { session });
      }
    }

    if (newRecords.length > 0) {
      await StudentAcademicRecord.insertMany(newRecords, { session });
    }

    await session.commitTransaction();
    session.endSession();

    const skipNote = skippedCount > 0 ? ` (${skippedCount} skipped — not Active)` : '';
    res.json({ message: `Successfully processed ${promotedCount} promotions.${skipNote}` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

module.exports = { promoteStudents };
