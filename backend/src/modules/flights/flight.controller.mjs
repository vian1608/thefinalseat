import flightService from './flight.service.mjs';

export const flightController = {
  search: async (req, res, next) => {
    try {
      const { from, to, departure, returnDate, adults, children, infants, travelClass, currency } = req.body;

      if (!from || !to || !departure) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters: from, to, departure' }
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

      const results = await flightService.searchFlights(searchParams);
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  },

  searchAirports: async (req, res, next) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Query parameter q is required' }
        });
      }

      const suggestions = await flightService.autocompleteAirports(q);
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      next(error);
    }
  }
};

export default flightController;
