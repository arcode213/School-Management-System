import api from './axios';

export const getEmployees    = (params) => api.get('/employees', { params });
export const getEmployee     = (id)     => api.get(`/employees/${id}`);
export const addEmployee     = (data)   => api.post('/employees', data);
export const updateEmployee  = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee  = (id)     => api.delete(`/employees/${id}`);
export const postSalary      = (data)   => api.post('/employees/salary', data);
export const getSalaryHistory= (id)     => api.get(`/employees/${id}/salary-history`);
