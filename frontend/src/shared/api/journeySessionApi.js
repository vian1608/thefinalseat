import api from './api';

export const journeySessionAPI = {
  createQuote: async (payload) => {
    const response = await api.post('/journey-sessions/quote', payload);
    return response.data;
  },
  getQuote: async (token) => {
    const response = await api.get(`/journey-sessions/quote/${encodeURIComponent(token)}`);
    return response.data;
  },
  createCheckout: async (payload) => {
    const response = await api.post('/journey-sessions/checkout', payload);
    return response.data;
  },
  getCheckout: async (token) => {
    const response = await api.get(`/journey-sessions/checkout/${encodeURIComponent(token)}`);
    return response.data;
  },
  updateCheckout: async (token, patch) => {
    const response = await api.patch(`/journey-sessions/checkout/${encodeURIComponent(token)}`, patch);
    return response.data;
  },
  createPayment: async (payload = {}) => {
    const response = await api.post('/journey-sessions/payment', payload);
    return response.data;
  },
  getPayment: async (token) => {
    const response = await api.get(`/journey-sessions/payment/${encodeURIComponent(token)}`);
    return response.data;
  },
  updatePayment: async (token, patch) => {
    const response = await api.patch(`/journey-sessions/payment/${encodeURIComponent(token)}`, patch);
    return response.data;
  },
  getReservation: async (token) => {
    const response = await api.get(`/journey-sessions/reservation/${encodeURIComponent(token)}`);
    return response.data;
  },
};

export default journeySessionAPI;
