from pathlib import Path

# --- BookingPage.js ---------------------------------------------------------
p = Path('frontend/src/features/bookings/pages/BookingPage.js')
s = p.read_text()

anchor = """const readBookingSessionJson = (key, fallback = null) => {\n  try {\n    const raw = sessionStorage.getItem(key);\n    return raw ? JSON.parse(raw) : fallback;\n  } catch {\n    return fallback;\n  }\n};\n"""
insert = anchor + """\nconst PASSENGER_REQUIRED_FIELDS = [\n  ['title', 'Title'],\n  ['firstName', 'First Name'],\n  ['lastName', 'Last Name'],\n  ['gender', 'Gender'],\n  ['dateOfBirth', 'Date of Birth'],\n];\n\nconst normalizePassengerFieldValue = (field, value) => {\n  if (field === 'title') return String(value || '').trim().replace(/\\.$/, '');\n  if (field === 'gender') return String(value || '').trim().toLowerCase();\n  return value;\n};\n\nconst getMissingPassengerFields = (passenger = {}) => PASSENGER_REQUIRED_FIELDS\n  .filter(([key]) => !String(passenger?.[key] ?? '').trim())\n  .map(([, label]) => label);\n\nconst isPassengerRequiredComplete = (passenger = {}) => getMissingPassengerFields(passenger).length === 0;\n"""
if anchor not in s:
    raise SystemExit('readBookingSessionJson anchor not found')
s = s.replace(anchor, insert, 1)

old = """  const [passengersList, setPassengersList] = useState([]);\n"""
new = """  const [passengersList, setPassengersList] = useState([]);\n  const [expandedPassengers, setExpandedPassengers] = useState({});\n  const [passengerValidationErrors, setPassengerValidationErrors] = useState({});\n\n  const revealPassenger = (index) => {\n    setExpandedPassengers(prev => ({ ...prev, [index]: true }));\n    window.setTimeout(() => {\n      document.querySelector(`[data-passenger-index=\\"${index}\\"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });\n    }, 40);\n  };\n"""
if old not in s:
    raise SystemExit('passengers state anchor not found')
s = s.replace(old, new, 1)

old = """  const isStep1Complete = passengersList.length > 0 && passengersList.every(p =>\n    !!(p.title && p.firstName && p.firstName.trim() && p.lastName && p.lastName.trim() && p.gender && p.dateOfBirth)\n  );\n"""
new = """  const isStep1Complete = passengersList.length > 0 && passengersList.every(isPassengerRequiredComplete);\n"""
if old not in s:
    raise SystemExit('step1 complete anchor not found')
s = s.replace(old, new, 1)

old = """  const handlePassengerChange = (index, field, value) => {\n    setPassengersList(prev => {\n      const newList = [...prev];\n      newList[index] = { ...newList[index], [field]: value };\n      return newList;\n    });\n  };\n"""
new = """  const handlePassengerChange = (index, field, value) => {\n    const normalizedValue = normalizePassengerFieldValue(field, value);\n    setPassengersList(prev => {\n      const newList = [...prev];\n      newList[index] = { ...newList[index], [field]: normalizedValue };\n      return newList;\n    });\n    setPassengerValidationErrors(prev => {\n      if (!prev[index]) return prev;\n      const next = { ...prev };\n      delete next[index];\n      return next;\n    });\n    if (error) setError('');\n  };\n"""
if old not in s:
    raise SystemExit('passenger change anchor not found')
s = s.replace(old, new, 1)

old = """  const validateForm = () => {\n    if (!isStep1Complete) {\n      setError('Please complete all required fields for all travelers (Title, First Name, Last Name, Gender, DOB).');\n      setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n      window.setTimeout(() => document.querySelector('.passenger-card-block select:invalid, .passenger-card-block input:invalid')?.focus(), 80);\n      return false;\n    }\n\n    if (!isStep2Complete) {\n"""
new = """  const validateForm = () => {\n    const firstIncompleteIndex = passengersList.findIndex(p => !isPassengerRequiredComplete(p));\n    if (firstIncompleteIndex >= 0) {\n      const missing = getMissingPassengerFields(passengersList[firstIncompleteIndex]);\n      setPassengerValidationErrors({ [firstIncompleteIndex]: missing });\n      setError(`Passenger #${firstIncompleteIndex + 1}: Please complete ${missing.join(', ')}.`);\n      setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n      revealPassenger(firstIncompleteIndex);\n      return false;\n    }\n\n    setPassengerValidationErrors({});\n\n    if (!isStep2Complete) {\n"""
if old not in s:
    raise SystemExit('validate form anchor not found')
s = s.replace(old, new, 1)

# When semantic DOB/passport validation fails, reveal the exact passenger card.
s = s.replace("""        setError(`${pName}: ${dobCheck.message}`);\n        setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n        return false;\n""", """        setError(`${pName}: ${dobCheck.message}`);\n        setPassengerValidationErrors({ [i]: [dobCheck.message] });\n        setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n        revealPassenger(i);\n        return false;\n""", 1)
s = s.replace("""          setError(`${pName}: ${passCheck.message}`);\n          setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n          return false;\n""", """          setError(`${pName}: ${passCheck.message}`);\n          setPassengerValidationErrors({ [i]: [passCheck.message] });\n          setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n          revealPassenger(i);\n          return false;\n""", 1)
s = s.replace("""          setError(`${pName}: ${expCheck.message}`);\n          setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n          return false;\n""", """          setError(`${pName}: ${expCheck.message}`);\n          setPassengerValidationErrors({ [i]: [expCheck.message] });\n          setOpenSections({ travellers: true, contact: false, requests: false, payment: false });\n          revealPassenger(i);\n          return false;\n""", 1)

s = s.replace('<form onSubmit={(e) => e.preventDefault()}>', '<form noValidate onSubmit={(e) => e.preventDefault()}>', 1)

old = """                {passengersList.map((passenger, idx) => (\n                  <div key={idx} className=\"passenger-card-block\">\n                    <h4 className=\"passenger-card-title\">\n                      <i className=\"fas fa-user\"></i> Passenger #{idx + 1} ({safeUpper(passenger?.role || 'ADULT')})\n                    </h4>\n"""
new = """                {passengersList.map((passenger, idx) => (\n                  <div\n                    key={idx}\n                    data-passenger-index={idx}\n                    className={`passenger-card-block${expandedPassengers[idx] === false ? ' tfs-pax-collapsed' : ''}${passengerValidationErrors[idx]?.length ? ' tfs-passenger-card-error' : ''}`}\n                  >\n                    <button\n                      type=\"button\"\n                      className=\"passenger-card-title\"\n                      aria-expanded={expandedPassengers[idx] !== false}\n                      onClick={() => setExpandedPassengers(prev => ({ ...prev, [idx]: prev[idx] === false }))}\n                    >\n                      <span className=\"passenger-card-title-main\">\n                        <i className=\"fas fa-user\"></i> Passenger #{idx + 1} ({safeUpper(passenger?.role || 'ADULT')})\n                      </span>\n                      <span className={`tfs-pax-mobile-state${isPassengerRequiredComplete(passenger) ? ' tfs-pax-state-complete' : ''}`}>\n                        {isPassengerRequiredComplete(passenger) ? 'Done' : 'Required'}\n                      </span>\n                      <i className=\"fas fa-chevron-down tfs-pax-mobile-chevron\" aria-hidden=\"true\"></i>\n                    </button>\n"""
if old not in s:
    raise SystemExit('passenger card header anchor not found')
s = s.replace(old, new, 1)

# Remove native HTML validity from passenger controls; React validation is authoritative.
trav_start = s.index('{/* SECTION 1: TRAVELLER DETAILS */}')
trav_end = s.index('{/* SECTION 2:', trav_start)
trav = s[trav_start:trav_end]
trav = trav.replace('                          required\n', '                          aria-required="true"\n')
trav = trav.replace('                          required\r\n', '                          aria-required="true"\r\n')
s = s[:trav_start] + trav + s[trav_end:]

# Add child-appropriate title choices without removing existing values.
s = s.replace("""                          <option value=\"Ms\">Ms.</option>\n                          <option value=\"Dr\">Dr.</option>\n""", """                          <option value=\"Ms\">Ms.</option>\n                          <option value=\"Miss\">Miss</option>\n                          <option value=\"Master\">Master</option>\n                          <option value=\"Dr\">Dr.</option>\n""", 1)

p.write_text(s)

# --- MobileBookingUX: stop mutating React-owned passenger DOM ---------------
p = Path('frontend/src/shared/mobile/installMobileBookingUX.js')
p.write_text("""// Passenger accordion behavior is now owned by BookingPage React state.\n// This installer intentionally performs no DOM injection/mutation. Keeping the\n// exported hook preserves the existing app bootstrap contract while avoiding a\n// second source of truth for passenger completion and collapse state.\nexport function installMobileBookingUX() {\n  if (typeof window === 'undefined') return;\n  window.__tfsMobileBookingUXInstalled = true;\n}\n\nexport default installMobileBookingUX;\n""")

# --- BookingPage.css: desktop + mobile React-owned accordion behavior --------
p = Path('frontend/src/features/bookings/pages/BookingPage.css')
s = p.read_text()
marker = '/* React-owned passenger accordion hardening */'
if marker not in s:
    s += """\n\n/* React-owned passenger accordion hardening */\n.passenger-card-title {\n  width: 100%;\n  border: 0;\n  text-align: left;\n  font: inherit;\n  display: flex;\n  align-items: center;\n  gap: 0.65rem;\n  cursor: pointer;\n}\n.passenger-card-title-main {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.55rem;\n  min-width: 0;\n}\n.passenger-card-title .tfs-pax-mobile-state {\n  margin-left: auto;\n  font-weight: 800;\n  font-size: 0.78rem;\n}\n.passenger-card-title .tfs-pax-state-complete {\n  color: #047857;\n}\n.passenger-card-title .tfs-pax-mobile-chevron {\n  flex: 0 0 auto;\n  transition: transform 160ms ease;\n}\n.passenger-card-block.tfs-pax-collapsed > :not(.passenger-card-title) {\n  display: none !important;\n}\n.passenger-card-block.tfs-pax-collapsed .tfs-pax-mobile-chevron {\n  transform: rotate(-90deg);\n}\n.passenger-card-block.tfs-passenger-card-error {\n  border-color: #dc2626 !important;\n  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.10) !important;\n}\n"""
p.write_text(s)

# --- PaymentSuccessPage.js: render-safe DTO normalization -------------------
p = Path('frontend/src/features/bookings/pages/PaymentSuccessPage.js')
s = p.read_text()
anchor = "import './PaymentSuccessPage.css';\n"
helper = anchor + """\nconst displayText = (value, fallback = '') => {\n  if (value === null || value === undefined || value === '') return fallback;\n  if (typeof value === 'string' || typeof value === 'number') return String(value);\n  if (typeof value === 'boolean') return value ? 'Yes' : 'No';\n  if (typeof value === 'object') {\n    const preferred = value.name || value.label || value.code || value.value || value.formatted;\n    if (preferred !== undefined && preferred !== null && typeof preferred !== 'object') return String(preferred);\n  }\n  return fallback;\n};\n\nconst safeArray = value => Array.isArray(value) ? value : [];\n"""
if anchor not in s:
    raise SystemExit('PaymentSuccess css import anchor not found')
s = s.replace(anchor, helper, 1)

repls = {
"""  const passengerName = booking.booking?.passengerName || booking.passenger_name || booking.passengerName || 'Valued Traveler';\n  const firstName = passengerName.split(' ')[0] || 'Traveler';\n  const code = booking.booking?.confirmationCode || booking.confirmation_code || booking.confirmationCode || booking.bookingId || confirmationCodeParam;\n  const email = booking.booking?.email || booking.email || userEmailParam || 'customer@example.com';\n  const phone = booking.booking?.phone || booking.phone || 'N/A';\n""": """  const passengerName = displayText(booking.booking?.passengerName || booking.passenger_name || booking.passengerName, 'Valued Traveler');\n  const firstName = passengerName.split(' ')[0] || 'Traveler';\n  const code = displayText(booking.booking?.confirmationCode || booking.confirmation_code || booking.confirmationCode || booking.bookingId || confirmationCodeParam, 'Reservation');\n  const email = displayText(booking.booking?.email || booking.email || userEmailParam, 'Email unavailable');\n  const phone = displayText(booking.booking?.phone || booking.phone, 'N/A');\n""",
"""  const paymentStatusDisplay = isPaid ? 'Paid' : 'Pending';\n  const bookingStatusDisplay = (booking.booking?.status || booking.status || 'PENDING').toUpperCase();\n""": """  const paymentStatusDisplay = isPaid ? 'Paid' : 'Pending';\n  const bookingStatusDisplay = displayText(booking.booking?.status || booking.status, 'PENDING').toUpperCase();\n""",
"""  const flightsList = Array.isArray(booking.flights) && booking.flights.length > 0\n    ? booking.flights\n    : (booking.itinerary?.outbound || (Array.isArray(booking.itinerary_segments) && booking.itinerary_segments.length > 0 ? booking.itinerary_segments : []));\n\n  const outboundSegments = (booking.itinerary?.outbound && booking.itinerary.outbound.length > 0)\n    ? booking.itinerary.outbound\n    : flightsList.filter(f => (f.leg || f.journey_direction || '').toLowerCase() === 'outbound' || (!f.leg && flightsList.indexOf(f) === 0));\n\n  const returnSegments = (booking.itinerary?.return && booking.itinerary.return.length > 0)\n    ? booking.itinerary.return\n    : flightsList.filter(f => (f.leg || f.journey_direction || '').toLowerCase() === 'return' || (!f.leg && flightsList.indexOf(f) > 0));\n""": """  const itineraryOutbound = safeArray(booking.itinerary?.outbound);\n  const itineraryReturn = safeArray(booking.itinerary?.return);\n  const flightsList = safeArray(booking.flights).length > 0\n    ? safeArray(booking.flights)\n    : (itineraryOutbound.length > 0 ? itineraryOutbound : safeArray(booking.itinerary_segments));\n\n  const outboundSegments = itineraryOutbound.length > 0\n    ? itineraryOutbound\n    : flightsList.filter(f => displayText(f?.leg || f?.journey_direction).toLowerCase() === 'outbound' || (!f?.leg && flightsList.indexOf(f) === 0));\n\n  const returnSegments = itineraryReturn.length > 0\n    ? itineraryReturn\n    : flightsList.filter(f => displayText(f?.leg || f?.journey_direction).toLowerCase() === 'return' || (!f?.leg && flightsList.indexOf(f) > 0));\n""",
"""  const currency = (booking.booking?.currency || booking.currency || 'USD').toUpperCase();\n""": """  const currency = displayText(booking.booking?.currency || booking.currency, 'USD').toUpperCase();\n""",
"""  const cardRef = booking.cardReference || booking.paymentMethod || booking.payment_method || {};\n  const cardholderName = cardRef.cardholderName || cardRef.cardholder_name || booking.passenger_name || passengerName;\n  const cardBrand = cardRef.cardBrand || cardRef.card_brand || cardRef.brand || null;\n""": """  const rawCardRef = booking.cardReference || booking.paymentMethod || booking.payment_method || {};\n  const cardRef = rawCardRef && typeof rawCardRef === 'object' && !Array.isArray(rawCardRef) ? rawCardRef : {};\n  const cardholderName = displayText(cardRef.cardholderName || cardRef.cardholder_name || booking.passenger_name, passengerName);\n  const cardBrand = displayText(cardRef.cardBrand || cardRef.card_brand || cardRef.brand, '');\n""",
"""  const billingAddr = cardRef.billingAddress || [\n""": """  const billingAddr = displayText(cardRef.billingAddress) || [\n""",
"""  const billingPhone = cardRef.billingPhone || cardRef.billing_phone || phone;\n""": """  const billingPhone = displayText(cardRef.billingPhone || cardRef.billing_phone, phone);\n""",
}
for old, new in repls.items():
    if old not in s:
        raise SystemExit('PaymentSuccess replacement anchor not found: ' + old[:80])
    s = s.replace(old, new, 1)

# Make itinerary JSX resilient to any unexpected object-shaped legacy field.
for expr in [
    'seg.airlineName || seg.airline || \'Airline\'',
    'seg.flightNumber || seg.flight_number || \'N/A\'',
    'seg.cabinClass || seg.cabin || \'Economy\'',
    'seg.departureAirport || seg.originCode || seg.departure_airport || seg.origin_airport',
    'seg.originName || seg.originCity || seg.origin_city || \'\'',
    'seg.arrivalAirport || seg.destinationCode || seg.arrival_airport || seg.destination_airport',
    'seg.destinationName || seg.destinationCity || seg.destination_city || \'\'',
]:
    s = s.replace('{' + expr + '}', '{displayText(' + expr + ')}')

p.write_text(s)

print('checkout passenger + confirmation hardening patch applied')
