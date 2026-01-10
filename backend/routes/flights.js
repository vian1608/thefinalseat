const express = require('express');
const router = express.Router();
const amadeusService = require('../services/amadeus-service');

// Search flights
router.post('/search', async (req, res) => {
  try {
    const { from, to, departure, returnDate, passengers, travelClass, maxResults } = req.body;

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
      passengers: passengers || 1,
      travelClass: travelClass || 'ECONOMY',
      maxResults: maxResults || 10
    };

    const result = await amadeusService.searchFlights(searchParams);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to search flights' 
    });
  }
});

module.exports = router;
