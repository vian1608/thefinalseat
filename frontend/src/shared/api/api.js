import axios from 'axios';

/** Use same-origin /api in production even if a Vercel env var points at localhost. */
function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal) {
      return '/api';
    }
    return process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  }
  return process.env.REACT_APP_API_URL || '/api';
}

const API_BASE_URL = resolveApiBaseUrl();

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
    const resData = response.data || {};
    
    // Normalize response: if backend returns `{ success: true, data: [flight1, flight2...], meta: {...} }`
    // format to `{ success: true, data: { flights: [...], meta: {...} } }` for SearchResultsPage compatibility
    if (resData.success && Array.isArray(resData.data)) {
      return {
        ...resData,
        data: {
          flights: resData.data,
          meta: resData.meta || {}
        }
      };
    }
    return resData;
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
  search: async (query) => {
    const response = await api.get('/bookings/search', { params: { query } });
    return response.data;
  },
  saveAbandoned: async (data) => {
    const response = await api.post('/bookings/abandoned', data);
    return response.data;
  },
  deleteAbandoned: async (sessionKey) => {
    const response = await api.delete(`/bookings/abandoned/${sessionKey}`);
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
  createStripeSession: async (payload) => {
    const response = await api.post('/payments/stripe/create-checkout-session', payload);
    return response.data;
  },
  getStripeSessionStatus: async (sessionId) => {
    const response = await api.get('/payments/stripe/session-status', { params: { session_id: sessionId } });
    return response.data;
  },
  createPayPalOrder: async (bookingId) => {
    const response = await api.post('/paypal/create-order', { bookingId });
    return response.data;
  },
  capturePayPalOrder: async (bookingId, paypalOrderId) => {
    const response = await api.post('/paypal/capture-order', { bookingId, paypalOrderId });
    return response.data;
  },
};

// Consulting inquiry API
export const inquiryAPI = {
  submitConsulting: async (payload, serviceType) => {
    if (serviceType) {
      payload.serviceType = serviceType;
    }
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
  getBookings: async (filters = {}) => {
    const response = await api.get('/admin/bookings', { params: filters });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
  updateBooking: async (id, updateData) => {
    const response = await api.put(`/admin/bookings/${id}`, updateData);
    return response.data;
  }
};

export default api;
