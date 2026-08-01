const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    required: true
  },
  academicSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a transaction title'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Please specify transaction type'],
    enum: ['Income', 'Expense'],
    default: 'Expense'
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery', 'Food', 'Tuition', 'Donation', 'Grant', 'Other'],
    default: 'Other'
  },
  amount: {
    type: Number,
    required: [true, 'Please specify the transaction amount'],
    min: [0, 'Transaction amount cannot be negative']
  },
  date: {
    type: Date,
    required: [true, 'Please select the date'],
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
