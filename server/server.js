const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./utils/connectDB');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

dotenv.config();

// Connect to DB
connectDB();

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
