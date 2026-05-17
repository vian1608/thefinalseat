import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Flight API
export const flightAPI = {
  search: async (searchParams) => {
    const response = await api.post('/flights/search', searchParams);
    return response.data;
  },
};

// Airport API
export const airportAPI = {
  search: async (query) => {
    const response = await api.get('/airports/search', { params: { q: query } });
    return response.data;
  },
};

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

// Booking API
export const bookingAPI = {
  create: async (bookingData) => {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },
  getByUser: async (userId) => {
    const response = await api.get(`/bookings/user/${userId}`);
    return response.data;
  },
  getByReference: async (reference) => {
    const response = await api.get(`/bookings/${reference}`);
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  createRazorpayOrder: async (amount, currency = 'USD') => {
    const response = await api.post('/payments/razorpay/create-order', { amount, currency });
    return response.data;
  },
  verifyRazorpayPayment: async (paymentData) => {
    const response = await api.post('/payments/razorpay/verify', paymentData);
    return response.data;
  },
};

// Consulting inquiry API
export const inquiryAPI = {
  submitConsulting: async (payload) => {
    const response = await api.post('/inquiries/consulting', payload);
    return response.data;
  },
};

// Admin API
export const adminAPI = {
  login: async (credentials) => {
    const response = await api.post('/admin/login', credentials);
    return response.data;
  },
  getBookings: async () => {
    const response = await api.get('/admin/bookings');
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
};

export default api;
