# School Management System

This is a comprehensive MERN stack School Management System built with React, Node.js, Express, and MongoDB.

## Features Completed
- **Authentication**: JWT-based role authentication (Admin, Accountant, Teacher).
- **Dashboard**: Real-time stats, dynamic charts (Recharts), and modern glassmorphism UI.
- **Student Records**: CRUD operations, filtering, pagination, and detailed profiles.
- **Employee Records**: Complete staff management including monthly salary slip generation and tracking.
- **Fee Management**: Bulk fee generation, individual payment tracking with partial/discount logic, and outstanding dues tracking.
- **Challan Printing**: Custom layout for 3-part bank fee vouchers using `react-to-print`.
- **Dues & Reports**: Financial reporting (Fees vs Salaries), profit/loss calculation, and CSV exports for all major grids.

## Technology Stack
- **Frontend**: React (Vite), Tailwind CSS v4, Lucide React (Icons), React Hook Form, Recharts, Axios, React Hot Toast.
- **Backend**: Node.js, Express.js, Mongoose, JWT, Bcryptjs.
- **Database**: MongoDB Atlas.

## Deployment Guide

### Frontend (Vercel)
1. Navigate to the `/client` directory.
2. Ensure you have the `VITE_API_URL` environment variable set in your Vercel project settings to point to your live backend URL (e.g. `https://your-api.onrender.com/api`).
3. Run `npm run build` to generate the static files.
4. Set the build command to `npm run build` and output directory to `dist`.

### Backend (Render / Heroku)
1. Navigate to the `/server` directory.
2. Make sure to set the following Environment Variables on your hosting provider:
   - `PORT=5000`
   - `MONGO_URI=your_mongodb_atlas_connection_string`
   - `JWT_SECRET=your_super_secret_key`
   - `NODE_ENV=production`
3. The server starts with `npm start` (make sure it's defined in `package.json` as `"start": "node server.js"`).

## Testing the System Locally
- **Admin**: The admin account was seeded automatically (`admin@school.com` / `admin123`).
- Use the **Generate Bulk Fees** tool in the Fees page to test the challan generation and outstanding dues.
- Post salaries in the Employees section to populate the Financial Reports.
