import express from 'express';
import flightController from './flight.controller.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';

const router = express.Router();

const searchRateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Too many search requests. Please wait before searching again.'
});

router.post('/search', searchRateLimiter, flightController.search);
router.get('/airports', flightController.searchAirports); // Legacy fallback or separate route
router.get('/airports/search', flightController.searchAirports); // Matching target routing

export default router;
export { router as flightRouter };
