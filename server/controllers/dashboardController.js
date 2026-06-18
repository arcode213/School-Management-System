const mongoose = require('mongoose');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const FeeRecord = require('../models/FeeRecord');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// @desc    Get all dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getStats = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;

    // Build query filters based on provided headers.
    // Student counts are derived from StudentAcademicRecord because status
    // (Active/Left/Graduated) and the per-session class live there — the Student
    // document itself has no status field and is not session-scoped.
    const recordFilter = { isDeleted: false };
    const empFilter = { isDeleted: false };
    const feeFilter = { isDeleted: false };

    if (currentCampus) {
      recordFilter.campus = new mongoose.Types.ObjectId(currentCampus);
      empFilter.campus = new mongoose.Types.ObjectId(currentCampus);
      feeFilter.campus = new mongoose.Types.ObjectId(currentCampus);
    }

    if (currentSession) {
      recordFilter.academicSession = new mongoose.Types.ObjectId(currentSession);
      feeFilter.academicSession = new mongoose.Types.ObjectId(currentSession);
    }

    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();

    // Student counts (scoped to selected campus + session)
    const [totalStudents, activeStudents, leftStudents, graduatedStudents] = await Promise.all([
      StudentAcademicRecord.countDocuments(recordFilter),
      StudentAcademicRecord.countDocuments({ ...recordFilter, status: 'Active' }),
      StudentAcademicRecord.countDocuments({ ...recordFilter, status: 'Left' }),
      StudentAcademicRecord.countDocuments({ ...recordFilter, status: 'Graduated' }),
    ]);

    // New admissions this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newAdmissions = await StudentAcademicRecord.countDocuments({
      ...recordFilter,
      admissionDate: { $gte: startOfMonth },
    });

    // Employee counts
    const [totalEmployees, activeEmployees] = await Promise.all([
      Employee.countDocuments(empFilter),
      Employee.countDocuments({ ...empFilter, status: 'Active' }),
    ]);

    const teacherCount = await Employee.countDocuments({
      ...empFilter,
      status: 'Active',
      designation: 'Teacher',
    });

    // Fee stats - this month
    const feeThisMonth = await FeeRecord.aggregate([
      { $match: { ...feeFilter, feeMonth: currentMonth, feeYear: currentYear } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$amountPaid' },
          totalDue: { $sum: '$balance' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Total outstanding dues (all time within session/campus)
    const totalDues = await FeeRecord.aggregate([
      { $match: { ...feeFilter, status: { $in: ['Unpaid', 'Partial', 'Overdue'] }, hasBeenCarriedForward: false } },
      { $group: { _id: null, totalDue: { $sum: '$balance' } } },
    ]);

    res.json({
      students: {
        total: totalStudents,
        active: activeStudents,
        left: leftStudents,
        graduated: graduatedStudents,
        newThisMonth: newAdmissions,
      },
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        teachers: teacherCount,
        staff: activeEmployees - teacherCount,
      },
      fees: {
        collectedThisMonth: feeThisMonth[0]?.totalCollected || 0,
        dueThisMonth: feeThisMonth[0]?.totalDue || 0,
        totalAmount: feeThisMonth[0]?.totalAmount || 0,
        totalOutstandingDues: totalDues[0]?.totalDue || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Monthly fee collection for the last 12 months
// @route   GET /api/dashboard/monthly-fees
// @access  Private
const getMonthlyFees = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const feeFilter = { isDeleted: false };
    if (currentCampus) feeFilter.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) feeFilter.academicSession = new mongoose.Types.ObjectId(currentSession);

    const now = new Date();
    const results = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = MONTHS[d.getMonth()];
      const year = d.getFullYear();

      const agg = await FeeRecord.aggregate([
        { $match: { ...feeFilter, feeMonth: month, feeYear: year } },
        { $group: { _id: null, collected: { $sum: '$amountPaid' }, due: { $sum: '$balance' } } },
      ]);

      results.push({
        month: `${month.substring(0, 3)} ${year}`,
        collected: agg[0]?.collected || 0,
        due: agg[0]?.due || 0,
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Class-wise student count
// @route   GET /api/dashboard/class-distribution
// @access  Private
const getClassDistribution = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    
    // We now query StudentAcademicRecord instead of Student directly
    const recordFilter = { isDeleted: false, status: 'Active' };
    if (currentCampus) recordFilter.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) recordFilter.academicSession = new mongoose.Types.ObjectId(currentSession);

    const data = await StudentAcademicRecord.aggregate([
      { $match: recordFilter },
      { $group: { _id: '$className', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json(data.map((d) => ({ class: d._id || 'Unassigned', count: d.count })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Fee status distribution (Paid/Unpaid/Partial) for current month
// @route   GET /api/dashboard/fee-status
// @access  Private
const getFeeStatus = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const feeFilter = { isDeleted: false };
    if (currentCampus) feeFilter.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) feeFilter.academicSession = new mongoose.Types.ObjectId(currentSession);

    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();

    const data = await FeeRecord.aggregate([
      { $match: { ...feeFilter, feeMonth: currentMonth, feeYear: currentYear, hasBeenCarriedForward: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { Paid: 0, Unpaid: 0, Partial: 0 };
    data.forEach((d) => { result[d._id] = d.count; });

    res.json([
      { name: 'Paid', value: result.Paid || 0 },
      { name: 'Unpaid', value: result.Unpaid || 0 },
      { name: 'Partial', value: result.Partial || 0 },
      { name: 'Overdue', value: result.Overdue || 0 },
    ]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Recent fee payments
// @route   GET /api/dashboard/recent-payments
// @access  Private
const getRecentPayments = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const feeFilter = { isDeleted: false, status: { $ne: 'Unpaid' } };
    if (currentCampus) feeFilter.campus = currentCampus;
    if (currentSession) feeFilter.academicSession = currentSession;

    const payments = await FeeRecord.find(feeFilter)
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('student', 'fullName studentId') // Cannot populate class/section here directly from Student, need AcademicRecord
      .populate('studentAcademicRecord', 'className section');

    // Format response to match existing frontend
    const formatted = payments.map(p => {
      const doc = p.toJSON();
      if (doc.studentAcademicRecord) {
        doc.student = {
          ...doc.student,
          class: doc.studentAcademicRecord.className,
          section: doc.studentAcademicRecord.section
        };
      }
      return doc;
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getStats, getMonthlyFees, getClassDistribution, getFeeStatus, getRecentPayments };
