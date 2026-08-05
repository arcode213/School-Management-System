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
    const { className, tuitionFee, admissionFee, examFee, transportFee, miscFee, annualFee } = req.body;

    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Campus and Session context required.' });
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { campus: currentCampus, academicSession: currentSession, className },
      // isActive is set explicitly: a structure deactivated by the class remap
      // would otherwise stay hidden after being re-saved here.
      { tuitionFee, admissionFee, examFee, transportFee, miscFee, annualFee: annualFee || 0, isActive: true },
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

    // fatherName is included so the override list and the edit dialog can tell two
    // students with the same name apart.
    const overrides = await StudentFeeOverride.find(filter).populate('student', 'fullName studentId fatherName');
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
    const { student, customTuitionFee, customTransportFee, customMiscFee, customAnnualFee, reason } = req.body;

    // A blank input means "no override for this fee, fall back to the class
    // structure", so it must UNSET the field rather than store null — a stored null
    // would read back as an override and the generator would bill 0. An explicit 0 is
    // a real override (fee excused) and is kept.
    const set = {};
    const unset = {};
    if (reason !== undefined) set.reason = reason;
    for (const [field, value] of Object.entries({
      customTuitionFee, customTransportFee, customMiscFee, customAnnualFee,
    })) {
      if (value === undefined || value === null || value === '') unset[field] = '';
      else set[field] = Number(value);
    }

    // Both operators are added only when they have something in them: Mongo rejects an
    // empty `$set`, which is exactly what an override that clears every fee produces.
    const update = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const override = await StudentFeeOverride.findOneAndUpdate(
      { student, campus: currentCampus, academicSession: currentSession },
      update,
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
          annualFee: struct.annualFee || 0,
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
      // Carried across at face value. The increment applies to tuition only — it is a
      // monthly raise, and adding it to a one-off annual fee would silently inflate it
      // by the same amount every year the session is rolled over.
      if (ovr.customAnnualFee !== undefined && ovr.customAnnualFee !== null) {
        updateData.customAnnualFee = ovr.customAnnualFee;
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
