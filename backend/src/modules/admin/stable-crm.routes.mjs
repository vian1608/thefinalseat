import express from 'express';
import authenticate from '../../middleware/authenticate.mjs';
import authorize from '../../middleware/authorize.mjs';
import stableCrmService from './stable-crm.service.mjs';

const router = express.Router();

router.use(authenticate, authorize(['admin']));

const requestId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const sendError = (res, error, fallbackCode, ref) => {
  const status = Number(error?.status) || 500;
  return res.status(status).json({
    success: false,
    requestId: ref,
    error: {
      code: error?.code || fallbackCode,
      message: error?.message || 'The CRM operation failed.',
      details: error?.details || null
    }
  });
};

router.get('/bookings', async (req, res) => {
  const ref = requestId('CRM-LIST');
  try {
    const data = await stableCrmService.listBookings({
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search
    });
    return res.json({ success: true, requestId: ref, ...data, data });
  } catch (error) {
    return sendError(res, error, 'BOOKING_LIST_FAILED', ref);
  }
});

router.get('/bookings/:id', async (req, res) => {
  const ref = requestId('CRM-GET');
  try {
    const booking = await stableCrmService.getBooking(req.params.id);
    return res.json({ success: true, requestId: ref, booking, data: booking });
  } catch (error) {
    return sendError(res, error, 'BOOKING_LOAD_FAILED', ref);
  }
});

router.patch('/bookings/:id/pricing', async (req, res) => {
  const ref = requestId('CRM-PRICE');
  try {
    const booking = await stableCrmService.savePricing(
      req.params.id,
      req.body || {},
      req.user?.email || req.user?.id || 'admin'
    );
    return res.json({
      success: true,
      requestId: ref,
      message: 'Pricing saved to Supabase and verified.',
      booking,
      data: booking
    });
  } catch (error) {
    return sendError(res, error, 'PRICING_SAVE_FAILED', ref);
  }
});

router.patch('/bookings/:id/payment', async (req, res) => {
  const ref = requestId('CRM-PAY');
  try {
    const booking = await stableCrmService.savePayment(
      req.params.id,
      req.body || {},
      req.user?.email || req.user?.id || 'admin'
    );
    return res.json({
      success: true,
      requestId: ref,
      message: 'Payment authorization splits saved to Supabase and verified.',
      booking,
      data: booking
    });
  } catch (error) {
    return sendError(res, error, 'PAYMENT_SAVE_FAILED', ref);
  }
});

router.patch('/bookings/:id/status', async (req, res) => {
  const ref = requestId('CRM-STATUS');
  try {
    const booking = await stableCrmService.saveStatus(req.params.id, req.body || {});
    return res.json({
      success: true,
      requestId: ref,
      message: 'Booking status and notes saved.',
      booking,
      data: booking
    });
  } catch (error) {
    return sendError(res, error, 'STATUS_SAVE_FAILED', ref);
  }
});

router.patch('/bookings/:id/ticket', async (req, res) => {
  const ref = requestId('CRM-TICKET');
  try {
    const booking = await stableCrmService.saveTicket(
      req.params.id,
      req.body || {},
      req.user?.email || req.user?.id || 'admin'
    );
    return res.json({
      success: true,
      requestId: ref,
      message: 'Airline ticket details saved and verified.',
      booking,
      data: booking
    });
  } catch (error) {
    return sendError(res, error, 'TICKET_SAVE_FAILED', ref);
  }
});

router.post('/bookings/:id/emails/:type', async (req, res) => {
  const ref = requestId('CRM-EMAIL');
  try {
    const result = await stableCrmService.sendEmail(req.params.id, req.params.type, {
      force: Boolean(req.body?.force)
    });
    return res.json({
      success: true,
      requestId: ref,
      message: 'Email sent and delivery state refreshed.',
      email: result.email,
      booking: result.booking,
      data: result.booking
    });
  } catch (error) {
    return sendError(res, error, 'EMAIL_SEND_FAILED', ref);
  }
});

export default router;
export { router as stableCrmRouter };
