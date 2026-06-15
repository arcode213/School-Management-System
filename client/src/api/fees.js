import api from './axios';

export const getFees        = (params) => api.get('/fees', { params });
export const addFee         = (data)   => api.post('/fees', data);
export const addBulkFees    = (data)   => api.post('/fees/bulk', data);
export const getStudentFees = (id)     => api.get(`/fees/student/${id}`);
export const getFee         = (id)     => api.get(`/fees/${id}`);
export const getDues        = ()       => api.get('/fees/dues');
export const updateFee      = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee      = (id)     => api.delete(`/fees/${id}`);
