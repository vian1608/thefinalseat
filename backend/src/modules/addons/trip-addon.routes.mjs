import express from 'express';
import authenticate from '../../middleware/authenticate.mjs';
import authorize from '../../middleware/authorize.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';
import './trip-addon.persistence-hardening.mjs';
import './trip-addon-workflow-hardening.mjs';
import { tripAddonPublicController, tripAddonAdminController } from './trip-addon.controller.mjs';
import { tripAddonFlexController } from './trip-addon-flex.controller.mjs';

const router = express.Router();
const publicReadLimit = rateLimit({ windowMs: 60000, maxRequests: 60, message: 'Too many trip add-on requests. Please wait a minute.' });
const publicWriteLimit = rateLimit({ windowMs: 60000, maxRequests: 12, message: 'Too many change requests. Please wait a minute.' });
const adminReadLimit = rateLimit({ windowMs: 60000, maxRequests: 120, message: 'Too many admin requests. Please wait a minute.' });
const adminWriteLimit = rateLimit({ windowMs: 60000, maxRequests: 40, message: 'Too many trip add-on workflow changes. Please wait a minute.' });

router.get('/bookings/:reference/trip-addons', publicReadLimit, tripAddonPublicController.getByBookingReference);
router.get('/bookings/:reference/trip-addons/flex/change-requests', publicReadLimit, tripAddonFlexController.listCustomer);
router.post('/bookings/:reference/trip-addons/flex/change-requests', publicWriteLimit, tripAddonFlexController.create);

router.get('/admin/bookings/:id/trip-addons', adminReadLimit, authenticate, authorize(['admin']), tripAddonAdminController.getByBooking);
router.patch('/admin/bookings/:id/trip-addons/:requestId', adminWriteLimit, authenticate, authorize(['admin']), tripAddonAdminController.updateBaggageRequest);
router.post('/admin/bookings/:id/trip-addons/:requestId/send-offer', adminWriteLimit, authenticate, authorize(['admin']), tripAddonAdminController.sendBaggageOffer);
router.get('/admin/bookings/:id/trip-addons/flex/change-requests', adminReadLimit, authenticate, authorize(['admin']), tripAddonFlexController.listAdmin);
router.patch('/admin/bookings/:id/trip-addons/flex/change-requests/:changeRequestId', adminWriteLimit, authenticate, authorize(['admin']), tripAddonFlexController.updateAdmin);

export default router;
export { router as tripAddonRouter };
