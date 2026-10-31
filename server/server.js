const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./utils/connectDB');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { contextMiddleware } = require('./middleware/contextMiddleware');
const { auditMiddleware } = require('./middleware/auditMiddleware');

dotenv.config();

// Connect to DB
connectDB().catch(err => {
  console.error('Initial DB connection error:', err.message);
});

const app = express();

// Middleware
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://symecs.com',
  'https://www.symecs.com',
  ...envOrigins
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    const cleanOrigin = origin.replace(/\/+$/, '');
    
    // Check if the origin matches local, env url, Vercel domain, or symecs domain
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.startsWith('http://localhost:') ||
      cleanOrigin.startsWith('http://127.0.0.1:') ||
      cleanOrigin === 'https://symecs.com' ||
      cleanOrigin === 'https://www.symecs.com' ||
      cleanOrigin.endsWith('.symecs.com')
    ) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
// Excel imports POST the whole parsed sheet as JSON. The body-parser default of
// 100kb is blown by a few hundred rows, which surfaces as a 413
// "request entity too large". The client also chunks the import, so this ceiling
// is only a safety net.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure database is connected before processing requests (critical for serverless cold starts)
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/api/health') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(503).json({
      message: 'Database connection unavailable. Please try again.',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
});

// Global Context Middleware
app.use(contextMiddleware);

// Audit trail. Mounted globally and ahead of the routes so it sees every request
// exactly once: it takes a "before" reading here and writes the entry after the
// response has gone out, by which point `protect` has identified the caller.
app.use(auditMiddleware);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/fee-structures', require('./routes/feeStructureRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/system', require('./routes/systemRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

// Accounts & finance
app.use('/api/expense-categories', require('./routes/expenseCategoryRoutes'));
app.use('/api/recurring-expenses', require('./routes/recurringExpenseRoutes'));
app.use('/api/salaries', require('./routes/salaryRoutes'));
app.use('/api/accounts', require('./routes/accountsRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'School Management System API is running' });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Port
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
