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

      // Update current record's promotion status
      currentRecord.promotionStatus = promo.promotionStatus;
      await currentRecord.save({ session });

      // Create new record for the target session if not graduated
      if (promo.promotionStatus !== 'Graduated') {
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

    res.json({ message: `Successfully processed ${promotions.length} promotions.` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

module.exports = { promoteStudents };
