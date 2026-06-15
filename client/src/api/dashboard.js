import api from './axios';

export const getDashboardStats = () => api.get('/dashboard/stats');
export const getMonthlyFees = () => api.get('/dashboard/monthly-fees');
export const getClassDistribution = () => api.get('/dashboard/class-distribution');
export const getFeeStatus = () => api.get('/dashboard/fee-status');
export const getRecentPayments = () => api.get('/dashboard/recent-payments');
