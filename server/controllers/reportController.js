const mongoose = require('mongoose');
const FeeRecord = require('../models/FeeRecord');
const SalaryRecord = require('../models/SalaryRecord');

// @desc    Get financial summary report (Fees collected vs Salaries paid)
// @route   GET /api/reports/financial
const getFinancialReport = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { year } = req.query;
    const filterYear = year ? Number(year) : new Date().getFullYear();

    const feeFilter = { feeYear: filterYear, isDeleted: false, status: { $in: ['Paid', 'Partial'] } };
    const salaryFilter = { salaryYear: filterYear, isDeleted: false, status: 'Paid' };

    if (currentCampus) {
      feeFilter.campus = new mongoose.Types.ObjectId(currentCampus);
      salaryFilter.campus = new mongoose.Types.ObjectId(currentCampus);
    }

    if (currentSession) {
      feeFilter.academicSession = new mongoose.Types.ObjectId(currentSession);
      salaryFilter.academicSession = new mongoose.Types.ObjectId(currentSession);
    }

    // 1. Total Fees Collected (paidAmount)
    const feesResult = await FeeRecord.aggregate([
      { $match: feeFilter },
      { $group: {
          _id: '$feeMonth',
          collected: { $sum: '$amountPaid' }, // Note: changed from paidAmount to amountPaid to match FeeRecord schema
          discounts: { $sum: '$discount' }
      } }
    ]);

    // 2. Total Salaries Paid
    const salariesResult = await SalaryRecord.aggregate([
      { $match: salaryFilter },
      { $group: {
          _id: '$salaryMonth',
          paid: { $sum: '$netSalary' }
      } }
    ]);

    // Merge into a 12-month array
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    let totalRevenue = 0;
    let totalExpense = 0;
    
    const monthlyData = MONTHS.map(month => {
      const feeMatch = feesResult.find(f => f._id === month);
      const salMatch = salariesResult.find(s => s._id === month);
      
      const revenue = feeMatch ? feeMatch.collected : 0;
      const expense = salMatch ? salMatch.paid : 0;
      
      totalRevenue += revenue;
      totalExpense += expense;
      
      return {
        month,
        revenue,
        expense,
        profit: revenue - expense
      };
    });

    res.json({
      year: filterYear,
      summary: {
        totalRevenue,
        totalExpense,
        netProfit: totalRevenue - totalExpense
      },
      monthlyData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getFinancialReport };
