const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');

// Models
const Campus = require('../models/Campus');
const AcademicSession = require('../models/AcademicSession');
const Student = require('../models/Student');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const Employee = require('../models/Employee');
const FeeRecord = require('../models/FeeRecord');
const SalaryRecord = require('../models/SalaryRecord');

dotenv.config({ path: path.join(__dirname, '../.env') });

const classesList = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const sectionsList = ['A', 'B', 'C'];
const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seedData = async () => {
  try {
    await connectDB();
    console.log('--- Starting Data Seeding ---');

    console.log('Cleaning up previous seed data...');
    // Delete students and employees created by seed script
    const seedStudents = await Student.find({ fullName: { $regex: /^Seed Student/ } });
    const seedStudentIds = seedStudents.map(s => s._id);
    
    await StudentAcademicRecord.deleteMany({ student: { $in: seedStudentIds } });
    await FeeRecord.deleteMany({ student: { $in: seedStudentIds } });
    await Student.deleteMany({ fullName: { $regex: /^Seed Student/ } });
    
    const seedEmps = await Employee.find({ fullName: { $regex: /^Seed Emp/ } });
    const seedEmpIds = seedEmps.map(e => e._id);
    await SalaryRecord.deleteMany({ employee: { $in: seedEmpIds } });
    await Employee.deleteMany({ fullName: { $regex: /^Seed Emp/ } });
    console.log('Cleanup complete.');

    // 1. Ensure Campuses exist
    let campuses = await Campus.find({ isActive: true });
    if (campuses.length < 2) {
      console.log('Campuses not found, please run migrateData.js first or ensure 2 campuses exist.');
      process.exit(1);
    }
    const campusA = campuses[0];
    const campusB = campuses[1];

    // 2. Ensure 2 Sessions exist
    let session1 = await AcademicSession.findOne({ name: '2023-2024' });
    if (!session1) {
      session1 = await AcademicSession.create({ name: '2023-2024', startDate: new Date('2023-04-01'), endDate: new Date('2024-03-31'), isActive: false, status: 'Completed' });
    }
    let session2 = await AcademicSession.findOne({ name: '2024-2025' });
    if (!session2) {
      session2 = await AcademicSession.create({ name: '2024-2025', startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31'), isActive: true, status: 'Ongoing' });
    }

    // 3. Generate Employees (10 per campus)
    console.log('Generating Employees...');
    const empsToInsert = [];
    let empCounter = await Employee.countDocuments();

    for (let c of [campusA, campusB]) {
      for (let i = 0; i < 10; i++) {
        empCounter++;
        empsToInsert.push({
          employeeId: `EMP-${new Date().getFullYear()}-${String(empCounter).padStart(3, '0')}`,
          fullName: `Seed Emp ${c.name.split(' ')[0]} ${i + 1}`,
          fatherName: 'Father Name',
          designation: i < 7 ? 'Teacher' : 'Clerk',
          department: i < 7 ? 'Academics' : 'Administration',
          gender: i % 2 === 0 ? 'Male' : 'Female',
          phone: `0300${randomNum(1000000, 9999999)}`,
          cnic: `35202-${randomNum(1000000, 9999999)}-1`,
          salary: randomNum(30000, 60000),
          campus: c._id,
          status: 'Active'
        });
      }
    }
    const insertedEmps = await Employee.insertMany(empsToInsert);
    console.log(`Inserted ${insertedEmps.length} Employees`);

    // 4. Generate Students (300 per campus)
    console.log('Generating Students & Academic Records...');
    const studentsToInsert = [];
    const academicRecordsToInsert = [];
    let studentCounter = await Student.countDocuments();

    // To prevent duplicate roll numbers per class/section/session, we keep a counter
    const rollCounters = {}; 

    for (let c of [campusA, campusB]) {
      for (let i = 0; i < 300; i++) {
        studentCounter++;
        const sId = new mongoose.Types.ObjectId();
        const stdIdString = `SMS-${new Date().getFullYear()}-${String(studentCounter).padStart(4, '0')}`;
        
        studentsToInsert.push({
          _id: sId,
          studentId: stdIdString,
          fullName: `Seed Student ${c.name.split(' ')[0]} ${i + 1}`,
          fatherName: 'Seed Father',
          gender: i % 2 === 0 ? 'Male' : 'Female',
          phone: `0300${randomNum(1000000, 9999999)}`,
          address: 'Seed Address, Lahore',
          currentCampus: c._id,
          admissionDate: new Date('2023-04-10')
        });

        const sClass = randomItem(classesList);
        const sSec = randomItem(sectionsList);
        const nextClass = String(Math.min(10, Number(sClass) + 1));
        const rollKey1 = `${c._id}-2023-${sClass}`;
        const rollKey2 = `${c._id}-2024-${nextClass}`; // Next class for session 2
        rollCounters[rollKey1] = (rollCounters[rollKey1] || 0) + 1;
        rollCounters[rollKey2] = (rollCounters[rollKey2] || 0) + 1;

        // Session 1 Record (Promoted)
        const ar1Id = new mongoose.Types.ObjectId();
        academicRecordsToInsert.push({
          _id: ar1Id,
          student: sId,
          academicSession: session1._id,
          campus: c._id,
          className: sClass,
          section: sSec,
          rollNumber: String(rollCounters[rollKey1]),
          status: 'Promoted',
          promotionStatus: 'Promoted',
          feeStructure: { tuitionFee: 3000, transportFee: 1000 },
          admissionDate: new Date('2023-04-10')
        });

        // Session 2 Record (Active) - Promoted to next class if not 10
        const ar2Id = new mongoose.Types.ObjectId();
        academicRecordsToInsert.push({
          _id: ar2Id,
          student: sId,
          academicSession: session2._id,
          campus: c._id,
          className: nextClass,
          section: sSec,
          rollNumber: String(rollCounters[rollKey2]),
          status: 'Active',
          feeStructure: { tuitionFee: 3500, transportFee: 1200 },
          admissionDate: new Date('2024-04-05')
        });
      }
    }

    await Student.insertMany(studentsToInsert);
    await StudentAcademicRecord.insertMany(academicRecordsToInsert);
    console.log(`Inserted ${studentsToInsert.length} Students and ${academicRecordsToInsert.length} Academic Records`);

    // 5. Generate Fees (For recent months in session 2, just 2 months to save time)
    console.log('Generating Fee Records...');
    const feeRecordsToInsert = [];
    const recentMonths = ['April', 'May'];
    
    // We only need the active records for session 2
    const activeRecords = academicRecordsToInsert.filter(r => r.academicSession.toString() === session2._id.toString());
    
    // Batch processing to avoid memory issues
    const batchSize = 1000;
    
    for (let month of recentMonths) {
      for (let r of activeRecords) {
        feeRecordsToInsert.push({
          student: r.student,
          studentAcademicRecord: r._id,
          campus: r.campus,
          academicSession: session2._id,
          feeMonth: month,
          feeYear: 2024,
          tuitionFee: 3500,
          examFee: 0,
          transportFee: 1200,
          otherFee: 0,
          totalAmount: 4700,
          amountPaid: randomNum(0, 1) === 1 ? 4700 : 0, // 50% paid, 50% unpaid
          discount: 0,
          status: 'Pending', // Will be updated
          dueDate: new Date(2024, recentMonths.indexOf(month) + 3, 10), // Apr=3, May=4
          paymentDate: new Date(2024, recentMonths.indexOf(month) + 3, randomNum(1, 15))
        });
      }
    }

    // Set statuses correctly
    feeRecordsToInsert.forEach(f => {
      f.balance = f.totalAmount - f.amountPaid;
      if (f.balance === 0) f.status = 'Paid';
      else if (f.amountPaid > 0) f.status = 'Partial';
      else f.status = 'Unpaid';
    });

    for (let i = 0; i < feeRecordsToInsert.length; i += batchSize) {
      await FeeRecord.insertMany(feeRecordsToInsert.slice(i, i + batchSize));
    }
    console.log(`Inserted ${feeRecordsToInsert.length} Fee Records`);

    // 6. Generate Salaries for Employees
    console.log('Generating Salary Records...');
    const salaryRecordsToInsert = [];
    for (let emp of insertedEmps) {
      for (let month of recentMonths) {
        salaryRecordsToInsert.push({
          employee: emp._id,
          campus: emp.campus,
          academicSession: session2._id,
          salaryMonth: month,
          salaryYear: 2024,
          baseSalary: emp.salary,
          allowances: 2000,
          deductions: 0,
          netSalary: emp.salary + 2000,
          paymentMethod: 'Bank Transfer',
          status: 'Paid',
          paymentDate: new Date(2024, recentMonths.indexOf(month) + 3, 5)
        });
      }
    }
    await SalaryRecord.insertMany(salaryRecordsToInsert);
    console.log(`Inserted ${salaryRecordsToInsert.length} Salary Records`);

    console.log('--- Seeding Complete ---');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedData();
