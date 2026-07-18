import express from 'express';
const router = express.Router();
import serpapiService from '../services/serpapi-service.mjs';

// Search flights using SerpAPI
router.post('/search', async (req, res) => {
  try {
    const { from, to, departure, returnDate, adults, children, infants, travelClass, currency } = req.body;

    if (!from || !to || !departure) {
      return res.status(400).json({ 
        error: 'Missing required parameters: from, to, departure' 
      });
    }

    const searchParams = {
      from,
      to,
      departure,
      returnDate,
      adults: parseInt(adults || 1, 10),
      children: parseInt(children || 0, 10),
      infants: parseInt(infants || 0, 10),
      travelClass: travelClass || 'economy',
      currency: currency || 'USD'
    };

    const result = await serpapiService.searchFlights(searchParams);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('SerpAPI flight search router error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to search flights' 
    });
  }
});

export default router;
