import api from './axios';

export const getFinancialReport = (params) => api.get('/reports/financial', { params });
