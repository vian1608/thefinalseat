const MONTHS = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
const DATE_WITHOUT_YEAR_RE = new RegExp(`^(\\d{1,2})(${MONTHS})$`, 'i');
const DATE_WITH_YEAR_RE = new RegExp(`^(\\d{1,2})(${MONTHS})(\\d{2,4})$`, 'i');

export const currentTravelYear = () => new Date().getFullYear();

export function ensureGdsYear(dateToken, year = currentTravelYear()) {
  const token = String(dateToken || '').trim().toUpperCase();
  if (DATE_WITH_YEAR_RE.test(token) || /^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  const match = token.match(DATE_WITHOUT_YEAR_RE);
  if (!match) return token;
  return `${match[1]}${match[2]}${String(year)}`;
}

/**
 * Normalize the common agent/reference style:
 *   01 UA 2204 Y 12AUG EWRIAH 1200 1451 NN1
 * into the canonical parser style:
 *   SS UA 2204 Y 12AUG2026 EWR IAH 1200 1451
 *
 * Existing SS, labelled, JSON, OUTBOUND/RETURN and TRIP lines are preserved.
 */
export function normalizeGdsBlockForParser(rawText, year = currentTravelYear()) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return '';

      const upper = line.toUpperCase();
      if (
        upper.startsWith('TRIP') ||
        upper === 'OUTBOUND' ||
        upper === 'RETURN' ||
        upper === 'INBOUND' ||
        upper.startsWith('JOURNEY') ||
        upper.startsWith('SEGMENT') ||
        upper.startsWith('SEG ') ||
        upper.includes(':') ||
        line.startsWith('{') ||
        line.startsWith('[')
      ) {
        return line;
      }

      const tokens = line.split(/\s+/);

      // Canonical SS format, but allow a short date such as 12AUG by applying
      // the year selected in the UI.
      if (tokens[0]?.toUpperCase() === 'SS' && tokens.length >= 9) {
        const next = [...tokens];
        next[4] = ensureGdsYear(next[4], year);
        return next.join(' ');
      }

      // Numbered GDS/reference format. Supports either EWRIAH or EWR IAH.
      if (/^\d{1,2}$/.test(tokens[0] || '') && tokens.length >= 8) {
        const carrier = String(tokens[1] || '').toUpperCase();
        const flight = String(tokens[2] || '').toUpperCase();
        const bookingClass = String(tokens[3] || 'Y').toUpperCase();
        const date = ensureGdsYear(tokens[4], year);

        let from = '';
        let to = '';
        let departure = '';
        let arrival = '';

        const routeToken = String(tokens[5] || '').toUpperCase();
        if (/^[A-Z]{6}$/.test(routeToken)) {
          from = routeToken.slice(0, 3);
          to = routeToken.slice(3, 6);
          departure = tokens[6];
          arrival = tokens[7];
        } else if (/^[A-Z]{3}$/.test(routeToken) && /^[A-Z]{3}$/.test(String(tokens[6] || '').toUpperCase())) {
          from = routeToken;
          to = String(tokens[6]).toUpperCase();
          departure = tokens[7];
          arrival = tokens[8];
        }

        if (
          /^[A-Z0-9]{2,3}$/.test(carrier) &&
          /^\d{1,4}[A-Z]?$/i.test(flight) &&
          /^[A-Z]$/.test(bookingClass) &&
          from && to && departure && arrival
        ) {
          return `SS ${carrier} ${flight} ${bookingClass} ${date} ${from} ${to} ${departure} ${arrival}`;
        }
      }

      // Leave unknown lines untouched so the backend can still parse its
      // labelled/structured formats and return a useful validation message.
      return line;
    })
    .filter(Boolean)
    .join('\n');
}

export const GOOGLE_FLIGHTS_IMPORT_PROMPT = `I will paste flight details copied from Google Flights below this prompt.

Convert them into The Final Seat CRM itinerary import format.

Rules:
1. Output ONLY the formatted itinerary. Do not add explanation or markdown.
2. Keep every individual flight, including connections.
3. Use the marketing airline IATA code and flight number exactly as shown.
4. Use booking class Y when Google Flights only says Economy and no booking class is shown. Do not invent another booking class.
5. Use airport IATA codes.
6. Use local 24-hour times in HHMM format.
7. Use dates as DDMMMYYYY, for example 12AUG2026.
8. For an overnight arrival, add +1 after the arrival time when appropriate.
9. Do not invent PNR, ticket number, fare basis, availability, confirmation status, or terminal.
10. One line must represent one actual flight segment.

Use this line format:
01 UA 2204 Y 12AUG2026 EWRIAH 1200 1451 NN1
02 UA 1675 Y 12AUG2026 IAHMDE 1625 2110 NN1

For ONE WAY:
OUTBOUND
01 ...
02 ...

For ROUND TRIP:
OUTBOUND
01 ...
02 ...
RETURN
03 ...
04 ...

For MULTI CITY:
JOURNEY 1
01 ...
JOURNEY 2
02 ...
JOURNEY 3
03 ...

Preserve the real chronological order of the flights.

GOOGLE FLIGHTS DATA:
[paste the copied Google Flights itinerary here]`;
