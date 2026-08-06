export const CHATGPT_PROMPT_TEMPLATE = `You are an expert airline reservation and GDS itinerary formatter.

I will paste an itinerary copied from Google Flights. Convert it into a structured flight itinerary that can be imported into a travel CRM.

Important rules:
1. Extract every flight segment, including all connections.
2. Do not remove or combine connecting flights.
3. Preserve the exact travel order.
4. Separate outbound and return journeys.
5. Use airport IATA codes where clearly available.
6. Preserve the operating airline and marketing airline when both are shown.
7. Preserve flight numbers exactly.
8. Convert dates to YYYY-MM-DD.
9. Use 24-hour local time in HH:mm format.
10. Do not convert local times to UTC.
11. Identify overnight arrivals and date changes correctly.
12. Include cabin/class only when provided.
13. Include aircraft type only when provided.
14. Include layover duration when provided.
15. Do not invent missing information.
16. Use null for information that cannot be determined.
17. Never invent availability, fare basis, booking class, PNR, ticket number, terminal, or confirmation status.
18. A Google Flights itinerary is not proof of live GDS availability or a confirmed booking.
19. Produce a GDS-style reference only as a formatting aid. Do not claim that it is an executable or confirmed GDS reservation.
20. Return valid JSON only, with no markdown explanation before or after it.`;

export function buildGdsStyleReferenceLines(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments.map((seg, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const carrier = seg.carrier_code || seg.marketingAirlineCode || 'XX';
    const flight = seg.flight_number || seg.flightNumber || '0000';
    const cls = seg.booking_class || seg.bookingClass || 'Y';
    const depDateStr = seg.departure_date || seg.departureDate;

    let dateFmt = 'DDMMM';
    if (depDateStr) {
      const parts = depDateStr.split('-');
      if (parts.length === 3) {
        const mIdx = parseInt(parts[1], 10) - 1;
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        dateFmt = `${parts[2]}${months[mIdx] || 'MMM'}`;
      }
    }

    const from = seg.origin_airport || seg.departureAirport || 'XXX';
    const to = seg.destination_airport || seg.arrivalAirport || 'XXX';
    const depTime = (seg.departure_time || seg.departureTime || '00:00').replace(':', '');
    const arrTime = (seg.arrival_time || seg.arrivalTime || '00:00').replace(':', '');
    const status = 'NN1';

    return `${num} ${carrier} ${flight} ${cls} ${dateFmt} ${from}${to} ${depTime} ${arrTime} ${status}`;
  });
}
