const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');

// @desc    Get all fee structures for current campus and session
// @route   GET /api/feestructures
const getFeeStructures = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const filter = { isActive: true };
    if (currentCampus) filter.campus = currentCampus;
    if (currentSession) filter.academicSession = currentSession;

    const structures = await FeeStructure.find(filter).sort({ className: 1 });
    res.json(structures);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create or Update fee structure for a class
// @route   POST /api/feestructures
const saveFeeStructure = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { className, tuitionFee, admissionFee, examFee, transportFee, miscFee } = req.body;

    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Campus and Session context required.' });
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { campus: currentCampus, academicSession: currentSession, className },
      { tuitionFee, admissionFee, examFee, transportFee, miscFee },
      { new: true, upsert: true }
    );

    res.json(structure);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get custom overrides
// @route   GET /api/feestructures/overrides
const getOverrides = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const filter = { isActive: true };
    if (currentCampus) filter.campus = currentCampus;
    if (currentSession) filter.academicSession = currentSession;

    const overrides = await StudentFeeOverride.find(filter).populate('student', 'fullName studentId');
    res.json(overrides);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Save override
// @route   POST /api/feestructures/overrides
const saveOverride = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { student, customTuitionFee, customTransportFee, customMiscFee, reason } = req.body;

    const override = await StudentFeeOverride.findOneAndUpdate(
      { student, campus: currentCampus, academicSession: currentSession },
      { customTuitionFee, customTransportFee, customMiscFee, reason },
      { new: true, upsert: true }
    );
    res.json(override);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete override
// @route   DELETE /api/feestructures/overrides/:id
const deleteOverride = async (req, res) => {
  try {
    await StudentFeeOverride.findByIdAndDelete(req.params.id);
    res.json({ message: 'Override deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Rollover fee structures and overrides with increment
// @route   POST /api/fee-structures/rollover
const rolloverFeeStructure = async (req, res) => {
  try {
    const { currentCampus } = req;
    const { sourceSessionId, targetSessionId, incrementAmount = 0 } = req.body;

    if (!currentCampus) {
      return res.status(400).json({ message: 'Campus context required.' });
    }
    if (!sourceSessionId || !targetSessionId) {
      return res.status(400).json({ message: 'Source and Target session IDs are required.' });
    }
    if (sourceSessionId === targetSessionId) {
      return res.status(400).json({ message: 'Source and Target sessions cannot be the same.' });
    }

    const increment = Number(incrementAmount);
    if (isNaN(increment)) {
      return res.status(400).json({ message: 'Increment amount must be a number.' });
    }

    // 1. Rollover Class Fee Structures
    const sourceStructures = await FeeStructure.find({
      campus: currentCampus,
      academicSession: sourceSessionId,
      isActive: true
    });

    let structuresCount = 0;
    for (const struct of sourceStructures) {
      const newTuitionFee = (struct.tuitionFee || 0) + increment;
      
      await FeeStructure.findOneAndUpdate(
        {
          campus: currentCampus,
          academicSession: targetSessionId,
          className: struct.className
        },
        {
          tuitionFee: newTuitionFee,
          admissionFee: struct.admissionFee,
          examFee: struct.examFee,
          transportFee: struct.transportFee,
          miscFee: struct.miscFee,
          isActive: true
        },
        { new: true, upsert: true }
      );
      structuresCount++;
    }

    // 2. Rollover Student Fee Overrides
    const sourceOverrides = await StudentFeeOverride.find({
      campus: currentCampus,
      academicSession: sourceSessionId,
      isActive: true
    });

    let overridesCount = 0;
    for (const ovr of sourceOverrides) {
      const newCustomTuition = ovr.customTuitionFee !== undefined && ovr.customTuitionFee !== null
        ? ovr.customTuitionFee + increment
        : undefined;

      const updateData = {
        isActive: true,
        reason: ovr.reason || 'Rollover from previous session'
      };

      if (newCustomTuition !== undefined) {
        updateData.customTuitionFee = newCustomTuition;
      }
      if (ovr.customTransportFee !== undefined && ovr.customTransportFee !== null) {
        updateData.customTransportFee = ovr.customTransportFee;
      }
      if (ovr.customMiscFee !== undefined && ovr.customMiscFee !== null) {
        updateData.customMiscFee = ovr.customMiscFee;
      }

      await StudentFeeOverride.findOneAndUpdate(
        {
          student: ovr.student,
          campus: currentCampus,
          academicSession: targetSessionId
        },
        updateData,
        { new: true, upsert: true }
      );
      overridesCount++;
    }

    res.json({
      message: `Successfully carried forward fees to target session.`,
      structuresRolledOver: structuresCount,
      overridesRolledOver: overridesCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getFeeStructures, saveFeeStructure, getOverrides, saveOverride, deleteOverride, rolloverFeeStructure };
