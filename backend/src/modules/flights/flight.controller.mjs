import flightService from './flight.service.mjs';

function extractIataCode(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    const code = String(value.code || value.iata || value.id || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : '';
  }

  const text = String(value).trim();
  if (/^[A-Z]{3}$/i.test(text)) return text.toUpperCase();
  const match = text.match(/\(([A-Z]{3})\)/i);
  return match ? match[1].toUpperCase() : '';
}

export const flightController = {
  search: async (req, res) => {
    try {
      const { from, to, departure, returnDate, adults, children, infants, travelClass, currency } = req.body;

      if (!from || !to || !departure) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters: from, to, departure' },
        });
      }

      const fromCode = extractIataCode(from);
      const toCode = extractIataCode(to);

      if (!fromCode || !toCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AIRPORT_CODE',
            message: 'Origin and destination must be valid 3-letter IATA airport codes (for example TPA, LAX or LOS). Select an airport from the suggestions instead of entering a city name alone.',
          },
        });
      }

      if (fromCode === toCode) {
        return res.status(400).json({
          success: false,
          error: { code: 'SAME_AIRPORT', message: 'Origin and destination airports must be different.' },
        });
      }

      const searchParams = {
        from: fromCode,
        to: toCode,
        departure,
        returnDate,
        adults: Number.parseInt(adults || 1, 10),
        children: Number.parseInt(children || 0, 10),
        infants: Number.parseInt(infants || 0, 10),
        travelClass: travelClass || 'economy',
        currency: currency || 'USD',
      };

      const results = await flightService.searchFlights(searchParams);
      const isProduction = (process.env.NODE_ENV || 'development') === 'production';

      if (isProduction && results.meta?.isMock) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'FLIGHT_SEARCH_UNAVAILABLE',
            message: 'Live flight search is temporarily unavailable. Mock results are blocked in production.',
          },
        });
      }

      return res.json({
        success: true,
        data: results.flights || [],
        meta: {
          source: results.meta?.isMock ? 'offline' : 'supplier',
          count: results.meta?.count || (results.flights?.length || 0),
        },
      });
    } catch (error) {
      console.error('[Controller Error] Flight search handler failed:', error);
      const statusCode = error.status || 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: error.code || 'FLIGHT_SEARCH_FAILED',
          message: error.message || 'Unable to retrieve available flights.',
        },
      });
    }
  },

  searchAirports: async (req, res, next) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Query parameter q is required' },
        });
      }

      const suggestions = await flightService.autocompleteAirports(q);
      return res.json({
        success: true,
        data: (Array.isArray(suggestions) ? suggestions : []).filter((airport) => /^[A-Z]{3}$/.test(String(airport?.code || '').toUpperCase())),
      });
    } catch (error) {
      return next(error);
    }
  },
};

export default flightController;
