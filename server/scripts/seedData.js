require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../utils/connectDB');

const Student = require('../models/Student');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const Employee = require('../models/Employee');
const SalaryRecord = require('../models/SalaryRecord');
const FeeRecord = require('../models/FeeRecord');
const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const Campus = require('../models/Campus');
const AcademicSession = require('../models/AcademicSession');

const firstNames = ['Ali', 'Ahmad', 'Fatima', 'Ayesha', 'Muhammad', 'Omar', 'Hassan', 'Zainab', 'Maryam', 'Bilal', 'Usman', 'Hamza', 'Khadija', 'Amir', 'Saad', 'Sara', 'Tariq', 'Imran', 'Kamran', 'Asma'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Shah', 'Malik', 'Raza', 'Qureshi', 'Hussain', 'Bukhari', 'Iqbal', 'Siddiqui', 'Chaudhry', 'Sheikh', 'Mahmood', 'Abbas'];

function getRandomName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

const CLASSES = ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['A', 'B', 'C'];

async function run() {
  await connectDB();

  console.log('Clearing database...');
  await Student.deleteMany({});
  await StudentAcademicRecord.deleteMany({});
  await Employee.deleteMany({});
  await SalaryRecord.deleteMany({});
  await FeeRecord.deleteMany({});
  await FeeStructure.deleteMany({});
  await StudentFeeOverride.deleteMany({});
  await Campus.deleteMany({});
  await AcademicSession.deleteMany({});
  console.log('Database cleared.');

  console.log('Creating Campuses and Session...');
  const mainCampus = await Campus.create({ name: 'Main Campus', code: 'MC', address: 'Main Blvd', phone: '0000000', isActive: true });
  const alHussainCampus = await Campus.create({ name: 'Al-Hussain Campus', code: 'AH', address: 'Hussain Rd', phone: '1111111', isActive: true });
  
  const session = await AcademicSession.create({ name: '2025-26', startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), isActive: true, status: 'Upcoming' });

  console.log('Creating Fee Structures...');
  const campuses = [mainCampus, alHussainCampus];
  
  for (const campus of campuses) {
    for (const className of CLASSES) {
      await FeeStructure.create({
        campus: campus._id,
        academicSession: session._id,
        className,
        tuitionFee: 1700,
        admissionFee: 0,
        examFee: 0,
        transportFee: 0,
        miscFee: 0
      });
    }
  }

  console.log('Creating Students...');
  let studentCount = 1;

  for (const campus of campuses) {
    for (let i = 0; i < 300; i++) {
      const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)];
      const sec = SECTIONS[Math.floor(Math.random() * SECTIONS.length)];
      const studentId = `STU-${campus.code}-${1000 + studentCount}`;
      const name = getRandomName();
      const fatherName = getRandomName();

      const student = await Student.create({
        studentId,
        fullName: name,
        fatherName,
        dateOfBirth: new Date(2010 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), 1),
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        status: 'Active',
        admissionDate: new Date(),
        class: cls,
        section: sec,
        currentCampus: campus._id
      });

      await StudentAcademicRecord.create({
        student: student._id,
        academicSession: session._id,
        campus: campus._id,
        className: cls,
        section: sec,
        rollNumber: i + 1,
        status: 'Active'
      });

      studentCount++;
    }
  }

  console.log('Seeding complete!');
  process.exit();
}

run();
