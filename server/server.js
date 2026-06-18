const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./utils/connectDB');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { contextMiddleware } = require('./middleware/contextMiddleware');

dotenv.config();

// Connect to DB
connectDB();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if the origin matches local, env url, or any Vercel domain
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Global Context Middleware
app.use(contextMiddleware);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/fee-structures', require('./routes/feeStructureRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/system', require('./routes/systemRoutes'));

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
