import tripAddonWorkflowService from './trip-addon-workflow.service.mjs';
import logger from '../../config/logger.mjs';

function errorResponse(res, error, fallbackCode) {
  const status = Number(error?.status) || 400;
  return res.status(status).json({
    success: false,
    error: {
      code: error?.code || fallbackCode,
      message: error?.message || 'Unable to process trip add-on request.',
    },
  });
}

export const tripAddonPublicController = {
  getByBookingReference: async (req, res) => {
    try {
      const data = await tripAddonWorkflowService.getPublic(req.params.reference);
      return res.json({ success: true, data, tripAddons: data });
    } catch (error) {
      if (error?.code !== 'BOOKING_NOT_FOUND') logger.warn(`[TripAddons] public read ${req.params.reference}: ${error.message}`);
      return errorResponse(res, error, 'TRIP_ADDON_READ_FAILED');
    }
  },
};

export const tripAddonAdminController = {
  getByBooking: async (req, res) => {
    try {
      const { booking, snapshot } = await tripAddonWorkflowService.loadSnapshot(req.params.id);
      return res.json({
        success: true,
        data: {
          bookingId: booking.id,
          confirmationCode: booking.confirmation_code || booking.confirmationCode,
          bookingVersion: booking.version ?? null,
          tripAddons: snapshot,
          baggageStatuses: tripAddonWorkflowService.BAGGAGE_STATUSES,
        },
      });
    } catch (error) {
      logger.error(`[TripAddons] admin read ${req.params.id}: ${error.message}`);
      return errorResponse(res, error, 'TRIP_ADDON_ADMIN_READ_FAILED');
    }
  },

  updateBaggageRequest: async (req, res) => {
    try {
      const actor = req.user?.email || req.user?.id || 'admin';
      const result = await tripAddonWorkflowService.updateRequest(req.params.id, req.params.requestId, req.body || {}, actor);
      return res.json({
        success: true,
        message: 'Baggage workflow updated.',
        data: { tripAddons: result.snapshot, request: result.request },
      });
    } catch (error) {
      logger.error(`[TripAddons] admin update ${req.params.id}/${req.params.requestId}: ${error.message}`);
      return errorResponse(res, error, 'BAGGAGE_WORKFLOW_UPDATE_FAILED');
    }
  },

  sendBaggageOffer: async (req, res) => {
    try {
      const actor = req.user?.email || req.user?.id || 'admin';
      const result = await tripAddonWorkflowService.sendOfferEmail(req.params.id, req.params.requestId, actor);
      return res.json({
        success: true,
        message: 'Baggage offer emailed to the customer.',
        data: { tripAddons: result.snapshot, request: result.request, email: result.email },
      });
    } catch (error) {
      logger.error(`[TripAddons] send baggage offer ${req.params.id}/${req.params.requestId}: ${error.message}`);
      return errorResponse(res, error, 'BAGGAGE_OFFER_SEND_FAILED');
    }
  },
};

export default {
  public: tripAddonPublicController,
  admin: tripAddonAdminController,
};
