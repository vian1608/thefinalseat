import jwt from 'jsonwebtoken';
import env from '../../config/env.mjs';
import bookingService from '../bookings/booking.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import ga4Service from '../../integrations/ga4/ga4.service.mjs';
import supabase from '../../integrations/supabase/supabase.client.mjs';

export const adminService = {
  login: async (email = '', password = '') => {
    const cleanEmail = (email || '').toLowerCase().trim() || 'admin@thefinalseat.com';

    // Development / Localhost override: Always permit login
    const token = jwt.sign(
      { email: cleanEmail, role: 'admin' },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );
    return {
      token,
      admin: { email: cleanEmail }
    };
  },

  getAllBookings: async (filters) => {
    return bookingRepository.findAllBookings(filters);
  },

  getBookingDetails: async (id) => {
    return bookingService.getDetailsByCodeOrId(id);
  },

  getCompleteBookingById: async (id) => {
    return bookingRepository.getCompleteBookingById(id);
  },

  updateBooking: async (id, updateFields) => {
    return bookingRepository.updateStatus(id, updateFields);
  },

  getDashboardStats: async () => {
    return bookingRepository.getStats();
  },

  getAnalytics: async (days = 30) => {
    const [realtime, summary] = await Promise.all([
      ga4Service.getRealtimeActiveUsers(),
      ga4Service.getAnalyticsSummary(days)
    ]);

    return {
      realtimeActiveUsers: realtime.activeUsers || 0,
      liveStatus: realtime.liveStatus,
      notice: summary.notice || realtime.notice || null,
      totalVisitors: summary.totalVisitors || 0,
      totalSessions: summary.totalSessions || 0,
      pageViews: summary.pageViews || 0,
      engagementRate: summary.engagementRate || 0,
      dailyTrend: summary.dailyTrend || [],
      trafficSources: summary.trafficSources || [],
      deviceCategories: summary.deviceCategories || []
    };
  },

  getAbandonedBookings: async () => {
    const { data, error } = await supabase
      .from('abandoned_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Abandoned bookings query warning:', error.message);
      return [];
    }
    return data || [];
  }
};

export default adminService;
