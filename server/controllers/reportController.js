const mongoose = require('mongoose');
const FeeRecord = require('../models/FeeRecord');
const SalaryRecord = require('../models/SalaryRecord');
const Expense = require('../models/Expense');

// @desc    Get financial summary report (Fees collected vs salaries + other expenses)
// @route   GET /api/reports/financial
const getFinancialReport = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { year } = req.query;
    const filterYear = year ? Number(year) : new Date().getFullYear();

    const feeFilter = { feeYear: filterYear, isDeleted: false, status: { $in: ['Paid', 'Partial'] } };
    const salaryFilter = { salaryYear: filterYear, isDeleted: false, status: 'Paid' };
    const expenseFilter = { isDeleted: false };

    if (currentCampus) {
      const campId = new mongoose.Types.ObjectId(currentCampus);
      feeFilter.campus = campId;
      salaryFilter.campus = campId;
      expenseFilter.campus = campId;
    }

    if (currentSession) {
      const sessId = new mongoose.Types.ObjectId(currentSession);
      feeFilter.academicSession = sessId;
      salaryFilter.academicSession = sessId;
      expenseFilter.academicSession = sessId;
    }

    // Set date bounds for custom expenses (Jan 1 to Dec 31 of filtered year)
    const startDate = new Date(`${filterYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${filterYear}-12-31T23:59:59.999Z`);
    expenseFilter.date = { $gte: startDate, $lte: endDate };

    // 1. Total Fees Collected (amountPaid)
    const feesResult = await FeeRecord.aggregate([
      { $match: feeFilter },
      { $group: {
          _id: '$feeMonth',
          collected: { $sum: '$amountPaid' },
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

    // 3. Custom Expenses
    const expensesResult = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: {
          _id: { $month: '$date' },
          amount: { $sum: '$amount' }
      } }
    ]);

    // Merge into a 12-month array
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    let totalRevenue = 0;
    let totalExpense = 0;
    
    const monthlyData = MONTHS.map((month, idx) => {
      const feeMatch = feesResult.find(f => f._id === month);
      const salMatch = salariesResult.find(s => s._id === month);
      const expMatch = expensesResult.find(e => e._id === (idx + 1));
      
      const revenue = feeMatch ? feeMatch.collected : 0;
      const salaryExpense = salMatch ? salMatch.paid : 0;
      const customExpense = expMatch ? expMatch.amount : 0;
      const expense = salaryExpense + customExpense;
      
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
