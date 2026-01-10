const express = require('express');
const router = express.Router();
const amadeusService = require('../services/amadeus-service');

// Search airports
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      // Return mock suggestions for short queries
      const mockResults = amadeusService.getMockAirportSuggestions(q || '');
      return res.json({
        success: true,
        data: mockResults
      });
    }

    const airports = await amadeusService.searchAirports(q);
    
    res.json({
      success: true,
      data: airports
    });
  } catch (error) {
    console.error('Airport search error:', error);
    // Return mock data as fallback
    const mockResults = amadeusService.getMockAirportSuggestions(req.query.q || '');
    res.json({
      success: true,
      data: mockResults
    });
  }
});

module.exports = router;
