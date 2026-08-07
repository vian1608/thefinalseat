import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';

const memoryInquiriesStore = new Map();

export const enquiryRepository = {
  saveEnquiry: async (enquiryData) => {
    const payload = {
      service_type: enquiryData.serviceType || 'flights',
      status: 'NEW',
      name: (enquiryData.name || '').trim(),
      email: (enquiryData.email || '').trim(),
      phone: (enquiryData.phone || '').trim() || null,
      origin: (enquiryData.origin || '').trim() || null,
      destination: (enquiryData.destination || '').trim() || null,
      trip_type: (enquiryData.tripType || enquiryData.trip_type || '').trim() || null,
      travel_date: (enquiryData.travelDate || enquiryData.travel_date || '').trim() || null,
      return_date: (enquiryData.returnDate || enquiryData.return_date || '').trim() || null,
      passengers: String(enquiryData.passengers || '1'),
      cabin_class: (enquiryData.cabinClass || enquiryData.cabin || enquiryData.cabin_class || '').trim() || null,
      notes: (enquiryData.notes || '').trim() || null,
      sms_opt_in: Boolean(enquiryData.smsOptIn || enquiryData.sms_opt_in),
      preferred_destination: (enquiryData.preferredDestination || '').trim() || null,
      flexible_dates: (enquiryData.flexibleDates || '').trim() || null,
      source: (enquiryData.source || 'website').trim(),
      utm_source: (enquiryData.utm_source || enquiryData.utmSource || '').trim() || null,
      utm_medium: (enquiryData.utm_medium || enquiryData.utmMedium || '').trim() || null,
      utm_campaign: (enquiryData.utm_campaign || enquiryData.utmCampaign || '').trim() || null,
      utm_content: (enquiryData.utm_content || enquiryData.utmContent || '').trim() || null,
      gclid: (enquiryData.gclid || '').trim() || null,
      gbraid: (enquiryData.gbraid || '').trim() || null,
      wbraid: (enquiryData.wbraid || '').trim() || null,
      email_status: 'PENDING'
    };

    try {
      const { data, error } = await supabase
        .from('inquiries')
        .insert(payload)
        .select()
        .single();

      if (error) {
        logger.warn(`[EnquiryRepo] Supabase table insert warning: ${error.message}. Saving to resilience memory store.`);
        const fallbackId = `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
        const fallbackRecord = { id: fallbackId, ...payload, created_at: new Date().toISOString() };
        memoryInquiriesStore.set(fallbackId, fallbackRecord);
        return fallbackRecord;
      }

      return data;
    } catch (err) {
      logger.error('[EnquiryRepo] Exception during Supabase insert:', err.message);
      const fallbackId = `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
      const fallbackRecord = { id: fallbackId, ...payload, created_at: new Date().toISOString() };
      memoryInquiriesStore.set(fallbackId, fallbackRecord);
      return fallbackRecord;
    }
  },

  updateEmailStatus: async (leadId, { status, provider, messageId, error }) => {
    if (!leadId) return;
    try {
      await supabase
        .from('inquiries')
        .update({
          email_status: status,
          email_provider: provider || null,
          email_message_id: messageId || null,
          email_error: error || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
    } catch (err) {
      logger.warn(`[EnquiryRepo] Failed to update email status for lead ${leadId}:`, err.message);
    }
  }
};

export default enquiryRepository;
