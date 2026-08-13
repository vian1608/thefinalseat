from pathlib import Path

path = Path('frontend/src/features/bookings/pages/PaymentSuccessPage.js')
text = path.read_text()

import_needle = "import { bookingAPI } from '../../../shared/api/api';\n"
assert import_needle in text, 'booking API import anchor missing'
text = text.replace(
    import_needle,
    import_needle + "import AirlineLogo from '../../../shared/components/AirlineLogo';\n",
    1,
)

safe_array = "const safeArray = value => Array.isArray(value) ? value : [];\n"
assert safe_array in text, 'safeArray anchor missing'
helper = r'''const safeArray = value => Array.isArray(value) ? value : [];

const AIRLINE_LOGO_SLUGS = {
  'delta': 'delta',
  'delta air lines': 'delta',
  'delta airlines': 'delta',
  'klm': 'klm',
  'klm royal dutch airlines': 'klm',
  'american airlines': 'american-airlines',
  'united': 'united',
  'united airlines': 'united',
  'southwest': 'southwest',
  'southwest airlines': 'southwest',
  'lufthansa': 'lufthansa',
  'british airways': 'british-airways',
  'air france': 'air-france',
  'alaska airlines': 'alaska-airlines',
  'singapore airlines': 'singapore-airlines',
  'cathay pacific': 'cathay-pacific',
  'emirates': 'emirates',
  'hawaiian airlines': 'hawaiian',
};

const airlineNameFor = (segment = {}) => displayText(
  segment.airlineName || segment.carrier_name || segment.airline || segment.carrier,
  'Airline',
);

const airlineLogoSlugFor = (segment = {}) => {
  const key = airlineNameFor(segment).trim().toLowerCase();
  return AIRLINE_LOGO_SLUGS[key] || key
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
'''
text = text.replace(safe_array, helper, 1)

old = '''                          <span className="segment-airline">
                            {seg.airlineLogoUrl && <img src={seg.airlineLogoUrl} alt={seg.airlineName} className="segment-logo" />}
                            <strong>{displayText(seg.airlineName || seg.airline || 'Airline')}</strong> ({displayText(seg.flightNumber || seg.flight_number || 'N/A')})
                          </span>'''
new = '''                          <span className="segment-airline">
                            <AirlineLogo
                              slug={airlineLogoSlugFor(seg)}
                              src={displayText(seg.airlineLogoUrl || seg.airline_logo_url)}
                              airlineName={airlineNameFor(seg)}
                              className="segment-logo"
                            />
                            <strong>{airlineNameFor(seg)}</strong>
                            <span className="segment-flight-number">{displayText(seg.flightNumber || seg.flight_number || 'N/A')}</span>
                          </span>'''
count = text.count(old)
assert count == 2, f'expected 2 confirmation airline blocks, found {count}'
text = text.replace(old, new)

path.write_text(text)
print('Patched confirmation airline identity rendering')
