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
    required: [true, 'Please provide an expense title'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery', 'Food', 'Other'],
    default: 'Other'
  },
  amount: {
    type: Number,
    required: [true, 'Please specify the expense amount'],
    min: [0, 'Expense amount cannot be negative']
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
