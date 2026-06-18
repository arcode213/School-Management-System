require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./utils/connectDB');
const FeeRecord = require('./models/FeeRecord');
const SalaryRecord = require('./models/SalaryRecord');

const run = async () => {
  await connectDB();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const currentMonth = MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();
  
  const resFee = await FeeRecord.updateMany({ feeMonth: 'May' }, { $set: { feeMonth: currentMonth, feeYear: currentYear } });
  const resSal = await SalaryRecord.updateMany({ salaryMonth: 'May' }, { $set: { salaryMonth: currentMonth, salaryYear: currentYear } });
  
  console.log('Updated ' + resFee.modifiedCount + ' fee records to ' + currentMonth + ' ' + currentYear);
  console.log('Updated ' + resSal.modifiedCount + ' salary records to ' + currentMonth + ' ' + currentYear);
  process.exit(0);
};

run().catch(err => console.error(err));
