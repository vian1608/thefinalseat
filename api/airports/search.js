const LOCAL_AIRPORTS = [
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'United States' },
  { code: 'AUS', name: 'Austin-Bergstrom International Airport', city: 'Austin', state: 'TX', country: 'United States' },
  { code: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore', state: 'MD', country: 'United States' },
  { code: 'BOS', name: 'Logan International Airport', city: 'Boston', state: 'MA', country: 'United States' },
  { code: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', state: 'NC', country: 'United States' },
  { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'MDW', name: 'Midway International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'CVG', name: 'Cincinnati/Northern Kentucky International Airport', city: 'Cincinnati', state: 'OH', country: 'United States' },
  { code: 'CLE', name: 'Cleveland Hopkins International Airport', city: 'Cleveland', state: 'OH', country: 'United States' },
  { code: 'CMH', name: 'John Glenn Columbus International Airport', city: 'Columbus', state: 'OH', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas/Fort Worth', state: 'TX', country: 'United States' },
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', state: 'TX', country: 'United States' },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'United States' },
  { code: 'DTW', name: 'Detroit Metro Wayne County Airport', city: 'Detroit', state: 'MI', country: 'United States' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'United States' },
  { code: 'RSW', name: 'Southwest Florida International Airport', city: 'Fort Myers', state: 'FL', country: 'United States' },
  { code: 'HNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', state: 'HI', country: 'United States' },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'United States' },
  { code: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', state: 'TX', country: 'United States' },
  { code: 'IND', name: 'Indianapolis International Airport', city: 'Indianapolis', state: 'IN', country: 'United States' },
  { code: 'JAX', name: 'Jacksonville International Airport', city: 'Jacksonville', state: 'FL', country: 'United States' },
  { code: 'MCI', name: 'Kansas City International Airport', city: 'Kansas City', state: 'MO', country: 'United States' },
  { code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'United States' },
  { code: 'SNA', name: 'John Wayne Airport', city: 'Orange County', state: 'CA', country: 'United States' },
  { code: 'SDF', name: 'Louisville Muhammad Ali International Airport', city: 'Louisville', state: 'KY', country: 'United States' },
  { code: 'MEM', name: 'Memphis International Airport', city: 'Memphis', state: 'TN', country: 'United States' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'United States' },
  { code: 'MKE', name: 'Milwaukee Mitchell International Airport', city: 'Milwaukee', state: 'WI', country: 'United States' },
  { code: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis/St. Paul', state: 'MN', country: 'United States' },
  { code: 'BNA', name: 'Nashville International Airport', city: 'Nashville', state: 'TN', country: 'United States' },
  { code: 'MSY', name: 'Louis Armstrong New Orleans International Airport', city: 'New Orleans', state: 'LA', country: 'United States' },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'United States' },
  { code: 'OAK', name: 'San Francisco Bay Oakland International Airport', city: 'Oakland', state: 'CA', country: 'United States' },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'United States' },
  { code: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', state: 'PA', country: 'United States' },
  { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', country: 'United States' },
  { code: 'PIT', name: 'Pittsburgh International Airport', city: 'Pittsburgh', state: 'PA', country: 'United States' },
  { code: 'PDX', name: 'Portland International Airport', city: 'Portland', state: 'OR', country: 'United States' },
  { code: 'RDU', name: 'Raleigh-Durham International Airport', city: 'Raleigh/Durham', state: 'NC', country: 'United States' },
  { code: 'RIC', name: 'Richmond International Airport', city: 'Richmond', state: 'VA', country: 'United States' },
  { code: 'SMF', name: 'Sacramento International Airport', city: 'Sacramento', state: 'CA', country: 'United States' },
  { code: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', state: 'UT', country: 'United States' },
  { code: 'SAN', name: 'San Diego International Airport', city: 'San Diego', state: 'CA', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'United States' },
  { code: 'SJC', name: 'San Jose Mineta International Airport', city: 'San Jose', state: 'CA', country: 'United States' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'United States' },
  { code: 'STL', name: 'St. Louis Lambert International Airport', city: 'St. Louis', state: 'MO', country: 'United States' },
  { code: 'TPA', name: 'Tampa International Airport', city: 'Tampa', state: 'FL', country: 'United States' },
  { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', state: 'ON', country: 'Canada' },
  { code: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', state: 'BC', country: 'Canada' },
  { code: 'YUL', name: 'Montréal-Trudeau International Airport', city: 'Montreal', state: 'QC', country: 'Canada' },
  { code: 'YYC', name: 'Calgary International Airport', city: 'Calgary', state: 'AB', country: 'Canada' }
];

function parseDescription(description) {
  if (!description) return { city: '', state: '', country: '' };
  const parts = description.split(',').map(s => s.trim());
  if (parts.length === 2) {
    const isState = parts[1].length === 2 && parts[1] === parts[1].toUpperCase();
    if (isState) {
      return { city: parts[0], state: parts[1], country: 'United States' };
    } else {
      return { city: parts[0], state: '', country: parts[1] };
    }
  } else if (parts.length > 2) {
    const lastPart = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (lastPart === 'United States' || lastPart === 'USA') {
      return { city: parts[0], state: secondLast, country: 'United States' };
    }
    return { city: parts[0], state: secondLast.length <= 3 ? secondLast : '', country: lastPart };
  }
  return { city: description, state: '', country: '' };
}

function searchLocalAirports(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  return LOCAL_AIRPORTS.filter(airport => {
    return (
      airport.code.toLowerCase().includes(q) ||
      airport.name.toLowerCase().includes(q) ||
      airport.city.toLowerCase().includes(q) ||
      (airport.state && airport.state.toLowerCase().includes(q)) ||
      airport.country.toLowerCase().includes(q)
    );
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = (req.query.q || '').trim();

  if (!query || query.length < 2) {
    return res.status(200).json({
      success: true,
      data: searchLocalAirports(query)
    });
  }

  const localResults = searchLocalAirports(query);

  let apiResults = [];
  const apiKey = process.env.SERPAPI_API_KEY || '8df31a2da9a24a9565d2fa7d5dcd096a5f5542c1a42e42cf9f5d604e17871498';

  try {
    const params = new URLSearchParams({
      engine: 'google_flights_autocomplete',
      q: query,
      api_key: apiKey,
      exclude_regions: 'true',
      hl: 'en',
      gl: 'us'
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    const data = await response.json();

    if (response.ok && data.suggestions) {
      data.suggestions.forEach(suggestion => {
        if (suggestion.type === 'airport' && suggestion.id) {
          const descInfo = parseDescription(suggestion.description);
          apiResults.push({
            code: suggestion.id.toUpperCase(),
            name: suggestion.name,
            city: descInfo.city,
            state: descInfo.state,
            country: descInfo.country
          });
        } else if (suggestion.type === 'city' && suggestion.airports) {
          suggestion.airports.forEach(airport => {
            if (airport.id) {
              const descInfo = parseDescription(suggestion.name);
              apiResults.push({
                code: airport.id.toUpperCase(),
                name: airport.name,
                city: descInfo.city,
                state: descInfo.state,
                country: descInfo.country
              });
            }
          });
        }
      });
    }
  } catch (error) {
    console.warn('Vercel serverless SerpAPI autocomplete failed:', error.message);
  }

  const mergedMap = new Map();
  localResults.forEach(item => {
    mergedMap.set(item.code, item);
  });

  apiResults.forEach(item => {
    if (!mergedMap.has(item.code)) {
      const matchingLocal = LOCAL_AIRPORTS.find(la => la.code === item.code);
      if (matchingLocal) {
        mergedMap.set(item.code, matchingLocal);
      } else {
        mergedMap.set(item.code, item);
      }
    }
  });

  const finalResults = Array.from(mergedMap.values());
  res.status(200).json({
    success: true,
    data: finalResults.length > 0 ? finalResults : localResults
  });
};
