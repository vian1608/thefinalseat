export const itineraryMapper = {
  toDatabaseRows: (bookingId, flight, leg, tripType) => {
    if (!flight) return [];
    
    const airlineName = (
      flight.airline_name ||
      flight.airlineName ||
      flight.airline ||
      flight.carrier_name ||
      flight.carrierName ||
      flight.carrier ||
      'Commercial Airline'
    ).trim();

    const flightNumber = (
      flight.flight_number ||
      flight.flightNumber ||
      flight.flightNo ||
      flight.flight_no ||
      'N/A'
    ).trim();

    const depAirport = (
      flight.departure?.airport ||
      flight.departureAirport ||
      flight.origin_airport ||
      flight.originCode ||
      flight.origin_code ||
      (typeof flight.origin === 'object' ? flight.origin.code : flight.origin) ||
      flight.from ||
      flight.fromCode ||
      ''
    ).trim().toUpperCase();

    const arrAirport = (
      flight.arrival?.airport ||
      flight.arrivalAirport ||
      flight.destination_airport ||
      flight.destinationCode ||
      flight.destination_code ||
      (typeof flight.destination === 'object' ? flight.destination.code : flight.destination) ||
      flight.to ||
      flight.toCode ||
      ''
    ).trim().toUpperCase();

    const depDate = (
      flight.departure?.date ||
      flight.departureDate ||
      flight.departure_date ||
      flight.date ||
      ''
    ).trim();

    const arrDate = (
      flight.arrival?.date ||
      flight.arrivalDate ||
      flight.arrival_date ||
      depDate
    ).trim();

    const depTimeStr = (
      flight.departure?.time ||
      flight.departureTime ||
      flight.departure_time_str ||
      flight.departure_time ||
      ''
    ).trim();

    const arrTimeStr = (
      flight.arrival?.time ||
      flight.arrivalTime ||
      flight.arrival_time_str ||
      flight.arrival_time ||
      ''
    ).trim();

    if (!depAirport || !arrAirport) {
      const err = new Error(`ITINERARY_NORMALIZATION_FAILED: Flight '${airlineName} ${flightNumber}' is missing departure or arrival airport codes (dep: '${depAirport}', arr: '${arrAirport}').`);
      err.code = 'ITINERARY_NORMALIZATION_FAILED';
      throw err;
    }

    const row = {
      booking_id: bookingId,
      leg,
      trip_type: tripType,
      airline_name: airlineName,
      flight_number: flightNumber,
      departure_airport: depAirport,
      arrival_airport: arrAirport,
      departure_date: depDate,
      arrival_date: arrDate,
      departure_time_str: depTimeStr,
      arrival_time_str: arrTimeStr,
      duration: flight.duration || null,
      stops: typeof flight.stops === 'number' ? flight.stops : 0,
      cabin_class: flight.class || flight.cabinClass || flight.cabin_class || 'Economy',
      fare_details: flight.price || flight.fareDetails || null,
    };

    if (flight.segments) {
      row.fare_details = {
        ...row.fare_details,
        segments: flight.segments
      };
    }

    return [row];
  },

  toDomainModel: (flightsList) => {
    const outbound = flightsList.find(f => f.leg === 'outbound');
    const returnFlt = flightsList.find(f => f.leg === 'return');
    
    const buildLeg = (legRow) => {
      if (!legRow) return null;
      return {
        airline: legRow.airline_name,
        flightNumber: legRow.flight_number,
        departure: {
          airport: legRow.departure_airport,
          date: legRow.departure_date,
          time: legRow.departure_time_str,
        },
        arrival: {
          airport: legRow.arrival_airport,
          date: legRow.arrival_date,
          time: legRow.arrival_time_str,
        },
        class: legRow.cabin_class,
        stops: legRow.stops,
        price: legRow.fare_details,
        segments: legRow.fare_details?.segments || null
      };
    };

    const outboundModel = buildLeg(outbound);
    if (!outboundModel) return null;

    return {
      ...outboundModel,
      returnFlight: buildLeg(returnFlt)
    };
  }
};

export default itineraryMapper;
