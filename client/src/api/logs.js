import api from './axios';

export const getLogs = (params) => api.get('/logs', { params });
export const getLogMeta = () => api.get('/logs/meta');
export const getEntityHistory = (entity, id) => api.get(`/logs/entity/${entity}/${id}`);
