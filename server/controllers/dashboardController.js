const Student = require('../models/Student');
const Employee = require('../models/Employee');
const FeeRecord = require('../models/FeeRecord');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// @desc    Get all dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();

    // Student counts
    const [totalStudents, activeStudents, leftStudents, graduatedStudents] = await Promise.all([
      Student.countDocuments({ isDeleted: false }),
      Student.countDocuments({ isDeleted: false, status: 'Active' }),
      Student.countDocuments({ isDeleted: false, status: 'Left' }),
      Student.countDocuments({ isDeleted: false, status: 'Graduated' }),
    ]);

    // New admissions this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newAdmissions = await Student.countDocuments({
      isDeleted: false,
      admissionDate: { $gte: startOfMonth },
    });

    // Employee counts
    const [totalEmployees, activeEmployees] = await Promise.all([
      Employee.countDocuments({ isDeleted: false }),
      Employee.countDocuments({ isDeleted: false, status: 'Active' }),
    ]);

    const teacherCount = await Employee.countDocuments({
      isDeleted: false,
      status: 'Active',
      designation: 'Teacher',
    });

    // Fee stats - this month
    const feeThisMonth = await FeeRecord.aggregate([
      { $match: { feeMonth: currentMonth, feeYear: currentYear, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$amountPaid' },
          totalDue: { $sum: '$balance' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Total outstanding dues (all time)
    const totalDues = await FeeRecord.aggregate([
      { $match: { isDeleted: false, status: { $in: ['Unpaid', 'Partial'] } } },
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
    const now = new Date();
    const results = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = MONTHS[d.getMonth()];
      const year = d.getFullYear();

      const agg = await FeeRecord.aggregate([
        { $match: { feeMonth: month, feeYear: year, isDeleted: false } },
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
    const data = await Student.aggregate([
      { $match: { isDeleted: false, status: 'Active' } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
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
    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();

    const data = await FeeRecord.aggregate([
      { $match: { feeMonth: currentMonth, feeYear: currentYear, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { Paid: 0, Unpaid: 0, Partial: 0 };
    data.forEach((d) => { result[d._id] = d.count; });

    res.json([
      { name: 'Paid', value: result.Paid },
      { name: 'Unpaid', value: result.Unpaid },
      { name: 'Partial', value: result.Partial },
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
    const payments = await FeeRecord.find({ isDeleted: false, status: { $ne: 'Unpaid' } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('student', 'fullName class section studentId');

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getStats, getMonthlyFees, getClassDistribution, getFeeStatus, getRecentPayments };
