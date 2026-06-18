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
const User = require('../models/User');
const FeeRecord = require('../models/FeeRecord');
const SalaryRecord = require('../models/SalaryRecord');

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrateData = async () => {
  try {
    await connectDB();
    console.log('--- Starting Data Migration ---');

    // 1. Create Default Campuses
    let mainCampus = await Campus.findOne({ code: 'MAIN' });
    if (!mainCampus) {
      mainCampus = await Campus.create({
        name: 'Main Campus',
        code: 'MAIN',
        isActive: true
      });
      console.log('Created Main Campus');
    }

    let hussainCampus = await Campus.findOne({ code: 'AL-HUSSAIN' });
    if (!hussainCampus) {
      hussainCampus = await Campus.create({
        name: 'Al-Hussain Campus',
        code: 'AL-HUSSAIN',
        isActive: true
      });
      console.log('Created Al-Hussain Campus');
    }

    // 2. Create Default Academic Session
    let activeSession = await AcademicSession.findOne({ isActive: true });
    if (!activeSession) {
      activeSession = await AcademicSession.create({
        name: '2024-2025',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2025-03-31'),
        isActive: true,
        status: 'Ongoing'
      });
      console.log('Created Academic Session 2024-2025');
    }

    // 3. Migrate Users (Admin, Accountant, Teacher)
    // NOTE: Using native MongoDB update to bypass strict schema validation on string matching
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    for (const user of users) {
      let cId = null;
      if (user.campus === 'Main-Campus') cId = mainCampus._id;
      else if (user.campus === 'Al-Hussain Campus') cId = hussainCampus._id;
      
      await mongoose.connection.db.collection('users').updateOne(
        { _id: user._id },
        { $set: { campus: cId } }
      );
    }
    console.log('Users migrated');

    // 4. Migrate Employees
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    for (const emp of employees) {
      let cId = mainCampus._id;
      if (emp.campus === 'Al-Hussain Campus') cId = hussainCampus._id;
      
      await mongoose.connection.db.collection('employees').updateOne(
        { _id: emp._id },
        { $set: { campus: cId } }
      );
    }
    console.log('Employees migrated');

    // 5. Migrate Students & Create Academic Records
    const students = await mongoose.connection.db.collection('students').find({}).toArray();
    for (const stu of students) {
      let cId = mainCampus._id;
      if (stu.campus === 'Al-Hussain Campus') cId = hussainCampus._id;

      // Update student's currentCampus
      await mongoose.connection.db.collection('students').updateOne(
        { _id: stu._id },
        { 
          $set: { currentCampus: cId },
          $unset: { campus: "", class: "", section: "", rollNumber: "" }
        }
      );

      // Create Academic Record if it doesn't exist
      const existingRecord = await StudentAcademicRecord.findOne({
        student: stu._id,
        academicSession: activeSession._id
      });

      if (!existingRecord) {
        const record = await StudentAcademicRecord.create({
          student: stu._id,
          academicSession: activeSession._id,
          campus: cId,
          className: stu.class || 'Unassigned',
          section: stu.section || '',
          rollNumber: stu.rollNumber || '',
          status: stu.status || 'Active',
          admissionDate: stu.admissionDate
        });

        // 6. Migrate Fee Records for this student
        await mongoose.connection.db.collection('feerecords').updateMany(
          { student: stu._id },
          { 
            $set: { 
              campus: cId,
              academicSession: activeSession._id,
              studentAcademicRecord: record._id
            } 
          }
        );
      }
    }
    console.log('Students and Fees migrated');

    // 7. Migrate Salary Records
    const salaries = await mongoose.connection.db.collection('salaryrecords').find({}).toArray();
    for (const sal of salaries) {
      const emp = employees.find(e => e._id.toString() === sal.employee.toString());
      let cId = mainCampus._id;
      if (emp && emp.campus === 'Al-Hussain Campus') cId = hussainCampus._id;

      await mongoose.connection.db.collection('salaryrecords').updateOne(
        { _id: sal._id },
        { 
          $set: { 
            campus: cId,
            academicSession: activeSession._id
          } 
        }
      );
    }
    console.log('Salaries migrated');

    console.log('--- Migration Complete ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrateData();
