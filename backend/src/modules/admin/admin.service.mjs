import jwt from 'jsonwebtoken';
import env from '../../config/env.mjs';
import bookingService from '../bookings/booking.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import ga4Service from '../../integrations/ga4/ga4.service.mjs';
import supabase from '../../integrations/supabase/supabase.client.mjs';

export const adminService = {
  login: async (email, password) => {
    if (email === env.adminEmail && password === env.adminPassword) {
      const token = jwt.sign(
        { email, role: 'admin' },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
      );
      return {
        token,
        admin: { email }
      };
    } else {
      const err = new Error('Invalid admin credentials.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
  },

  getAllBookings: async (filters) => {
    const bookings = await bookingRepository.findAllBookings(filters);
    // Enrich with relations if requested or available
    const enriched = await Promise.all((bookings || []).map(async (b) => {
      try {
        const rels = await bookingRepository.getRelations(b.id);
        return {
          ...b,
          travellers: rels.travellers || [],
          contacts: rels.contacts || [],
          flights: rels.flights || [],
          payments: rels.payments || []
        };
      } catch (e) {
        return b;
      }
    }));
    return enriched;
  },

  getBookingDetails: async (id) => {
    return bookingService.getDetailsByCodeOrId(id);
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
