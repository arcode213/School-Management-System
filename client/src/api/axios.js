import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const campus = localStorage.getItem('sms_campus');
    if (campus) config.headers['x-campus-id'] = campus;
    
    const session = localStorage.getItem('sms_session');
    if (session) config.headers['x-session-id'] = session;
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally - clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sms_token');
      localStorage.removeItem('sms_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
