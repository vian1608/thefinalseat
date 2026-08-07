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

// Handle 401 Unauthorized responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('adminSession');
        if (window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Flight API
export const flightAPI = {
  search: async (searchParams) => {
    const response = await api.post('/flights/search', searchParams);
    const resData = response.data || {};
    
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
  getConfirmationDTO: async (confirmationCode) => {
    const response = await api.get(`/bookings/confirmation/${confirmationCode}`);
    return response.data;
  },
  getPaymentStatus: async (bookingId) => {
    const response = await api.get(`/bookings/${bookingId}/payment-status`);
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

// Whop API
export const whopAPI = {
  createCheckout: async (bookingId) => {
    const response = await api.post('/whop/create-checkout', { bookingId });
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

// Car Rental API (Booking.com Demand API v3.1)
export const carAPI = {
  search: async (searchParams) => {
    const response = await api.post('/cars/search', searchParams);
    return response.data;
  },
  getDetails: async (payload) => {
    const response = await api.post('/cars/details', payload);
    return response.data;
  },
  getDepots: async (payload) => {
    const response = await api.post('/cars/depots', payload);
    return response.data;
  },
  getSuppliers: async (payload) => {
    const response = await api.post('/cars/suppliers', payload);
    return response.data;
  },
  getDepotScores: async (payload) => {
    const response = await api.post('/cars/depot-scores', payload);
    return response.data;
  },
  getConstants: async (payload) => {
    const response = await api.post('/cars/constants', payload);
    return response.data;
  },
  autocompleteLocations: async (query) => {
    const response = await api.get('/cars/locations/autocomplete', { params: { q: query } });
    return response.data;
  },
  recordClick: async (clickData) => {
    const response = await api.post('/cars/click', clickData);
    return response.data;
  }
};

// Admin API
export const adminAPI = {
  login: async (credentials) => {
    const response = await api.post('/admin/login', credentials);
    return response.data;
  },
  getBookings: async (filters = {}, options = {}) => {
    const response = await api.get('/admin/bookings', { params: filters, ...options });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
  getAnalytics: async (days = 30) => {
    const response = await api.get('/admin/analytics', { params: { days } });
    return response.data;
  },
  getAbandonedBookings: async () => {
    const response = await api.get('/admin/abandoned-bookings');
    return response.data;
  },
  getBookingById: async (id, options = {}) => {
    const response = await api.get(`/admin/bookings/${id}`, options);
    return response.data;
  },
  getBookingDetails: async (id, options = {}) => {
    const response = await api.get(`/admin/bookings/${id}`, options);
    return response.data;
  },
  updateBooking: async (id, updateData) => {
    const response = await api.put(`/admin/bookings/${id}`, updateData);
    return response.data;
  },
  exportSelectedBackups: async (bookingIds) => {
    const response = await api.post('/admin/bookings/export', { bookingIds }, { responseType: 'json' });
    return response.data;
  },
  bulkDeleteBookings: async (bookingIds, adminPassword, confirmationText) => {
    const response = await api.post('/admin/bookings/bulk-delete', { bookingIds, adminPassword, confirmationText });
    return response.data;
  },
  importBookingBackup: async (backup, selectedBookings, adminPassword) => {
    const response = await api.post('/admin/bookings/import-backup', { backup, selectedBookings, adminPassword });
    return response.data;
  },
  patchStatusNotes: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/status-notes`, data);
    return response.data;
  },
  patchAuthorizationSettings: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/authorization-settings`, data);
    return response.data;
  },
  patchItinerary: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/itinerary`, data);
    return response.data;
  },
  patchPricing: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/pricing`, data);
    return response.data;
  },
  patchPaymentAuthorization: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/payment-authorization`, data);
    return response.data;
  },
  patchBillingDetails: async (id, data) => {
    const response = await api.patch(`/admin/bookings/${id}/billing-details`, data);
    return response.data;
  },
  parseItineraryText: async (text) => {
    const response = await api.post('/admin/itineraries/parse', { text });
    return response.data;
  },
  createBooking: async (data, options = {}) => {
    const response = await api.post('/admin/bookings', data, options);
    return response.data;
  },
  patchAirlineDetails: async (bookingId, data, options = {}) => {
    const response = await api.patch(`/admin/bookings/${bookingId}/airline-details`, data, options);
    return response.data;
  },
  getBookingEmailStatus: async (bookingId) => {
    const response = await api.get(`/admin/bookings/${bookingId}`);
    return response.data;
  },
  getBookingByClientRequestId: async (clientRequestId) => {
    const response = await api.get(`/admin/bookings/by-request/${clientRequestId}`);
    return response.data;
  },
  /**
   * Centralized admin email action.
   * Supported actions:
   *   send_booking_request_email | resend_booking_request_email
   *   send_authorization | resend_authorization
   *   send_authorization_email | resend_authorization_email
   *   send_final_ticket_email | resend_final_ticket_email
   */
  sendEmailAction: async (bookingId, action, extraData = {}, options = {}) => {
    const idempotencyKey = extraData.clientRequestId || ((typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await api.post(
      `/admin/bookings/${bookingId}/payment-action`,
      { action, clientRequestId: idempotencyKey, ...extraData },
      { headers: { 'Idempotency-Key': idempotencyKey }, ...options }
    );
    return response.data;
  },
  sendBookingRequestEmail: async (bookingId, resend = false, options = {}) => {
    return adminAPI.sendEmailAction(
      bookingId,
      resend ? 'resend_booking_request_email' : 'send_booking_request_email',
      {},
      options
    );
  },
  sendAuthorizationEmail: async (bookingId, resend = false, options = {}) => {
    return adminAPI.sendEmailAction(
      bookingId,
      resend ? 'resend_authorization' : 'send_authorization',
      {},
      options
    );
  },
  sendFinalTicketEmail: async (bookingId, resend = false, options = {}) => {
    return adminAPI.sendEmailAction(
      bookingId,
      resend ? 'resend_final_ticket_email' : 'send_final_ticket_email',
      {},
      options
    );
  },
};



export default api;
