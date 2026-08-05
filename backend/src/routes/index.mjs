import express from 'express';
import { authRouter } from '../modules/auth/auth.routes.mjs';
import { customerRouter } from '../modules/customers/customer.routes.mjs';
import { bookingRouter } from '../modules/bookings/booking.routes.mjs';
import { paymentRouter } from '../modules/payments/payment.routes.mjs';
import { flightRouter, airportRouter } from '../modules/flights/flight.routes.mjs';
import { enquiryRouter } from '../modules/enquiries/enquiry.routes.mjs';
import { adminRouter } from '../modules/admin/admin.routes.mjs';
import passengerAuthorizationController from '../modules/authorizations/passenger-authorization.controller.mjs';
import whopRouter from '../modules/payments/whop.routes.mjs';
import paypalController from '../modules/payments/paypal.controller.mjs';
import rateLimit from '../middleware/rate-limit.mjs';
import { twentyRouter } from '../integrations/twenty/twenty.routes.mjs';

import { noStore, publicLookupCache } from '../middleware/cache-control.middleware.mjs';

const router = express.Router();

const paypalRateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 15,
  message: 'Too many payment requests. Please wait a minute.'
});

const paypalRouter = express.Router();
paypalRouter.post('/create-order', paypalRateLimiter, paypalController.createOrder);
paypalRouter.post('/capture-order', paypalRateLimiter, paypalController.captureOrder);
paypalRouter.post('/webhook', paypalController.handleWebhook);

const authorizationRouter = express.Router();
authorizationRouter.get('/:token', passengerAuthorizationController.getAuthorization);
authorizationRouter.post('/accept', passengerAuthorizationController.acceptAuthorization);

// Private & User-Specific Routes — Strict No-Store Protection
router.use('/auth', noStore, authRouter);
router.use('/customers', noStore, customerRouter);
router.use('/bookings', noStore, bookingRouter);
router.use('/my-bookings', noStore, bookingRouter);
router.use('/payments', noStore, paymentRouter);
router.use('/paypal', noStore, paypalRouter);
router.use('/authorizations', noStore, authorizationRouter);
router.use('/authorization', noStore, authorizationRouter);
router.use('/admin', noStore, adminRouter);
router.use('/twenty', noStore, twentyRouter);

router.post('/webhooks/paypal', paypalController.handleWebhook);
router.use('/inquiries', enquiryRouter);
router.use('/enquiries', enquiryRouter);
router.use('/', whopRouter);

// Public Flight & Lookup Routes
router.use('/flights', flightRouter);
router.use('/airports', publicLookupCache(300, 86400, 3600), airportRouter);
import { carRouter } from '../modules/cars/car.routes.mjs';
router.use('/cars', carRouter);
import addressAutocompleteController from '../modules/flights/address-autocomplete.controller.mjs';

router.get('/address-autocomplete', publicLookupCache(300, 86400, 3600), addressAutocompleteController.getAddressAutocomplete);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    data: {
      status: 'ok',
      message: 'Urgent Travel API is running',
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
export { router as rootRouter };
