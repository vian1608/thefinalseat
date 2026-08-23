import express from 'express';
import authenticate from '../../middleware/authenticate.mjs';
import authorize from '../../middleware/authorize.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';
import { tripAddonPublicController, tripAddonAdminController } from './trip-addon.controller.mjs';

const router = express.Router();
const publicReadLimit = rateLimit({ windowMs: 60000, maxRequests: 60, message: 'Too many baggage-status requests. Please wait a minute.' });
const adminReadLimit = rateLimit({ windowMs: 60000, maxRequests: 120, message: 'Too many admin requests. Please wait a minute.' });
const adminWriteLimit = rateLimit({ windowMs: 60000, maxRequests: 40, message: 'Too many baggage workflow changes. Please wait a minute.' });

router.get('/bookings/:reference/trip-addons', publicReadLimit, tripAddonPublicController.getByBookingReference);
router.get('/admin/bookings/:id/trip-addons', adminReadLimit, authenticate, authorize(['admin']), tripAddonAdminController.getByBooking);
router.patch('/admin/bookings/:id/trip-addons/:requestId', adminWriteLimit, authenticate, authorize(['admin']), tripAddonAdminController.updateBaggageRequest);
router.post('/admin/bookings/:id/trip-addons/:requestId/send-offer', adminWriteLimit, authenticate, authorize(['admin']), tripAddonAdminController.sendBaggageOffer);

export default router;
export { router as tripAddonRouter };
