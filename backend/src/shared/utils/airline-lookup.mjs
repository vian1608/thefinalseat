/**
 * Canonical Airline Lookup Service
 * Maps IATA Carrier Code -> Airline Name & Airline Logo URL
 */

const AIRLINE_DICTIONARY = {
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
  AA: 'American Airlines',
  LH: 'Lufthansa',
  AC: 'Air Canada',
  WN: 'Southwest Airlines',
  BA: 'British Airways',
  AF: 'Air France',
  KL: 'KLM Royal Dutch Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  SQ: 'Singapore Airlines',
  NH: 'ANA (All Nippon Airways)',
  JL: 'Japan Airlines',
  QF: 'Qantas',
  TK: 'Turkish Airlines',
  EY: 'Etihad Airways',
  CX: 'Cathay Pacific',
  AS: 'Alaska Airlines',
  B6: 'JetBlue Airways',
  NK: 'Spirit Airlines',
  F9: 'Frontier Airlines',
  AZ: 'ITA Airways',
  IB: 'Iberia',
  AY: 'Finnair',
  SK: 'SAS Scandinavian Airlines',
  LX: 'Swiss International Air Lines',
  OS: 'Austrian Airlines',
  SN: 'Brussels Airlines',
  TP: 'TAP Air Portugal'
};

export function getAirlineName(carrierCode) {
  if (!carrierCode) return 'Airline information unavailable';
  const code = String(carrierCode).trim().toUpperCase();
  return AIRLINE_DICTIONARY[code] || null;
}

export function resolveAirlineName(carrierCode, providedName) {
  if (providedName && typeof providedName === 'string' && providedName.trim() && !providedName.toLowerCase().includes('commercial airline')) {
    return providedName.trim();
  }
  const found = getAirlineName(carrierCode);
  if (found) return found;
  if (carrierCode && typeof carrierCode === 'string' && carrierCode.trim()) {
    return `${carrierCode.trim().toUpperCase()} Airlines`;
  }
  return 'Airline information unavailable';
}

export function getCarrierLogoUrl(carrierCode) {
  const code = (carrierCode || 'UA').trim().toUpperCase();
  return `https://assets.duffel.com/img/airlines/for-floor/sq/${code}.png`;
}
