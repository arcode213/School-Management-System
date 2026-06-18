const Employee = require('../models/Employee');
const SalaryRecord = require('../models/SalaryRecord');
const mongoose = require('mongoose');

const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const count = await Employee.countDocuments();
  return `EMP-${year}-${String(count + 1).padStart(3, '0')}`;
};

// @desc    Add a new employee
// @route   POST /api/employees
const addEmployee = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'Campus context is required' });

    const employeeId = await generateEmployeeId();
    const employee = await Employee.create({ 
      ...req.body, 
      employeeId,
      campus: currentCampus
    });
    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all employees
// @route   GET /api/employees?designation=&department=&status=&search=&page=&limit=
const getEmployees = async (req, res) => {
  try {
    const { currentCampus } = req;
    const { designation, department, status, search, page = 1, limit = 10 } = req.query;
    const filter = { isDeleted: false };

    if (currentCampus) filter.campus = new mongoose.Types.ObjectId(currentCampus);
    if (designation) filter.designation = designation;
    if (department)  filter.department = department;
    if (status)      filter.status = status;
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { cnic: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Employee.countDocuments(filter);
    const employees = await Employee.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      employees,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false })
      .populate('campus', 'name code');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Soft delete employee
// @route   DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true, status: 'Terminated' } },
      { new: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Post monthly salary for an employee
// @route   POST /api/employees/salary
const postSalary = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Campus and Academic Session context are required' });
    }

    const { employeeId, salaryMonth, salaryYear, baseSalary, allowances, deductions, paymentMethod, remarks } = req.body;
    
    // Check if salary already posted for this month/year/session
    const existing = await SalaryRecord.findOne({ 
      employee: employeeId, 
      salaryMonth, 
      salaryYear,
      academicSession: currentSession, 
      isDeleted: false 
    });
    if (existing) {
      return res.status(400).json({ message: `Salary for ${salaryMonth} ${salaryYear} is already posted.` });
    }

    const netSalary = Number(baseSalary) + Number(allowances) - Number(deductions);

    const salary = await SalaryRecord.create({
      employee: employeeId,
      campus: currentCampus,
      academicSession: currentSession,
      salaryMonth,
      salaryYear,
      baseSalary,
      allowances,
      deductions,
      netSalary,
      paymentMethod,
      remarks,
      status: 'Paid'
    });

    res.status(201).json(salary);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Salary already posted for this month.' });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get salary history for an employee
// @route   GET /api/employees/:id/salary-history
const getSalaryHistory = async (req, res) => {
  try {
    const history = await SalaryRecord.find({ employee: req.params.id, isDeleted: false })
      .populate('academicSession', 'name')
      .populate('campus', 'name')
      .sort({ salaryYear: -1, createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, postSalary, getSalaryHistory
};
