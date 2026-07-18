import express from 'express';
const router = express.Router();
import serpapiService from '../services/serpapi-service.mjs';

// Search airports using SerpAPI Autocomplete
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      const mockResults = serpapiService.getMockAirportSuggestions(q || '');
      return res.json({
        success: true,
        data: mockResults
      });
    }

    const airports = await serpapiService.autocompleteAirports(q);
    
    res.json({
      success: true,
      data: airports
    });
  } catch (error) {
    console.error('Airport search route error:', error);
    const mockResults = serpapiService.getMockAirportSuggestions(req.query.q || '');
    res.json({
      success: true,
      data: mockResults
    });
  }
});

export default router;
