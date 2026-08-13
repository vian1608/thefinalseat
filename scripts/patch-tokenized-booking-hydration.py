from pathlib import Path

repo = Path('.')
booking_path = repo / 'frontend/src/features/bookings/pages/BookingPage.js'
voucher_path = repo / 'frontend/src/features/bookings/vouchers/BookingVoucherPage.js'
journey_routes_path = repo / 'frontend/src/features/journey/TokenizedJourneyRoutes.js'
journey_api_path = repo / 'frontend/src/shared/api/journeySessionApi.js'

booking = booking_path.read_text()
voucher = voucher_path.read_text()
journey_routes = journey_routes_path.read_text()
journey_api = journey_api_path.read_text()

# 1) BookingPage: hydrate synchronously from the server-provided payload first,
# falling back to sessionStorage only for legacy/simple routes.
helper_anchor = """const formatCch = (val = '') => {\n  return val.replace(/\\D/g, '').slice(0, 4);\n};\n\n"""
helper_insert = helper_anchor + """const readBookingSessionJson = (key, fallback = null) => {\n  try {\n    const raw = sessionStorage.getItem(key);\n    return raw ? JSON.parse(raw) : fallback;\n  } catch {\n    return fallback;\n  }\n};\n\n"""
if 'const readBookingSessionJson' not in booking:
    if helper_anchor not in booking:
        raise SystemExit('BookingPage helper anchor not found')
    booking = booking.replace(helper_anchor, helper_insert, 1)

old_init = """function Booking() {\n  const navigate = useNavigate();\n  const [flight, setFlight] = useState(null);\n  const [returnFlight, setReturnFlight] = useState(null);\n  const [error, setError] = useState('');\n"""
new_init = """function Booking({ initialJourneyPayload = null }) {\n  const navigate = useNavigate();\n  const [flight, setFlight] = useState(() =>\n    initialJourneyPayload?.selectedFlight || readBookingSessionJson('selectedFlight', null)\n  );\n  const [returnFlight, setReturnFlight] = useState(() =>\n    initialJourneyPayload?.returnFlight\n      || readBookingSessionJson('returnFlight', null)\n      || readBookingSessionJson('selectedReturnFlight', null)\n  );\n  const [error, setError] = useState('');\n"""
if old_init in booking:
    booking = booking.replace(old_init, new_init, 1)
elif 'function Booking({ initialJourneyPayload = null })' not in booking:
    raise SystemExit('BookingPage initializer anchor not found')

old_effect = """  useEffect(() => {\n    const flightData = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');\n    if (!flightData) { navigate('/'); return; }\n    setFlight(flightData);\n\n    const returnFlightData = JSON.parse(sessionStorage.getItem('returnFlight') || 'null');\n    setReturnFlight(returnFlightData);\n\n    const searchParams = JSON.parse(sessionStorage.getItem('searchParams') || '{}');\n    const adults = parseInt(searchParams.adults || 1, 10);\n    const children = parseInt(searchParams.children || 0, 10);\n    const infants = parseInt(searchParams.infants || 0, 10);\n"""
new_effect = """  useEffect(() => {\n    const flightData = initialJourneyPayload?.selectedFlight\n      || readBookingSessionJson('selectedFlight', null);\n    const returnFlightData = initialJourneyPayload?.returnFlight\n      || readBookingSessionJson('returnFlight', null)\n      || readBookingSessionJson('selectedReturnFlight', null);\n    const searchParams = initialJourneyPayload?.searchParams\n      || readBookingSessionJson('searchParams', {});\n\n    if (!flightData) {\n      setError('We could not restore the selected itinerary. Please retry this checkout link or search again.');\n      return;\n    }\n\n    setFlight(flightData);\n    setReturnFlight(returnFlightData);\n\n    const adults = parseInt(searchParams.adults || 1, 10);\n    const children = parseInt(searchParams.children || 0, 10);\n    const infants = parseInt(searchParams.infants || 0, 10);\n"""
if old_effect in booking:
    booking = booking.replace(old_effect, new_effect, 1)
elif 'const flightData = initialJourneyPayload?.selectedFlight' not in booking:
    raise SystemExit('BookingPage hydration effect anchor not found')

old_dep = """  }, [navigate]);\n\n  function createPassenger(role) {\n"""
new_dep = """  }, [initialJourneyPayload]);\n\n  function createPassenger(role) {\n"""
# Replace only the dependency belonging to the itinerary hydration effect by using
# the nearby createPassenger anchor.
if old_dep in booking:
    booking = booking.replace(old_dep, new_dep, 1)

# 2) Pass the authoritative server payload through the voucher wrapper.
old_voucher_export = """export default function BookingVoucherPage() {\n  return (\n    <>\n      <Booking />\n      <VoucherEnhancement />\n    </>\n  );\n}\n"""
new_voucher_export = """export default function BookingVoucherPage({ initialJourneyPayload = null }) {\n  return (\n    <>\n      <Booking initialJourneyPayload={initialJourneyPayload} />\n      <VoucherEnhancement />\n    </>\n  );\n}\n"""
if old_voucher_export in voucher:
    voucher = voucher.replace(old_voucher_export, new_voucher_export, 1)
elif 'BookingVoucherPage({ initialJourneyPayload = null })' not in voucher:
    raise SystemExit('BookingVoucherPage export anchor not found')

old_render = """      <BookingVoucherPage />\n      <CheckoutDraftPersistence token={checkoutToken} initialPayload={session.payload || {}} />\n"""
new_render = """      <BookingVoucherPage initialJourneyPayload={session.payload || {}} />\n      <CheckoutDraftPersistence token={checkoutToken} initialPayload={session.payload || {}} />\n"""
if old_render in journey_routes:
    journey_routes = journey_routes.replace(old_render, new_render, 1)
elif '<BookingVoucherPage initialJourneyPayload={session.payload || {}} />' not in journey_routes:
    raise SystemExit('TokenizedBookingPage render anchor not found')

# 3) Make checkout restore retryable and never infinite.
old_state = """  const [session, setSession] = useState(null);\n  const [error, setError] = useState('');\n\n  ensureBookingSessionBridge();\n"""
new_state = """  const [session, setSession] = useState(null);\n  const [error, setError] = useState('');\n  const [reloadKey, setReloadKey] = useState(0);\n\n  ensureBookingSessionBridge();\n"""
if old_state in journey_routes:
    journey_routes = journey_routes.replace(old_state, new_state, 1)

old_effect_start = """  useEffect(() => {\n    let cancelled = false;\n    journeySessionAPI.getCheckout(checkoutToken)\n"""
new_effect_start = """  useEffect(() => {\n    let cancelled = false;\n    setError('');\n    setSession(null);\n    journeySessionAPI.getCheckout(checkoutToken)\n"""
# Scope replacement to the TokenizedBookingPage portion by taking the occurrence
# after the component declaration.
component_idx = journey_routes.find('export function TokenizedBookingPage()')
if component_idx < 0:
    raise SystemExit('TokenizedBookingPage not found')
prefix = journey_routes[:component_idx]
suffix = journey_routes[component_idx:]
if old_effect_start in suffix:
    suffix = suffix.replace(old_effect_start, new_effect_start, 1)

old_effect_dep = """  }, [checkoutToken, navigate]);\n\n  if (error) return <JourneyState error title=\"This checkout link cannot be restored\" message={error} />;\n"""
new_effect_dep = """  }, [checkoutToken, navigate, reloadKey]);\n\n  if (error) return (\n    <JourneyState\n      error\n      title=\"This checkout link cannot be restored\"\n      message={error}\n      action={(\n        <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>\n          <button\n            type=\"button\"\n            onClick={() => setReloadKey((current) => current + 1)}\n            style={{ padding: '.8rem 1.15rem', borderRadius: 10, border: 0, background: '#8b1538', color: '#fff', fontWeight: 700, cursor: 'pointer' }}\n          >\n            Retry checkout\n          </button>\n          <button\n            type=\"button\"\n            onClick={() => navigate('/')}\n            style={{ padding: '.8rem 1.15rem', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}\n          >\n            Search flights\n          </button>\n        </div>\n      )}\n    />\n  );\n"""
if old_effect_dep in suffix:
    suffix = suffix.replace(old_effect_dep, new_effect_dep, 1)
elif 'reloadKey' not in suffix:
    raise SystemExit('TokenizedBookingPage effect dependency/error anchor not found')
journey_routes = prefix + suffix

# 4) All journey-session network operations receive a finite timeout. Axios will
# reject instead of leaving the browser tab spinning forever.
if 'const JOURNEY_SESSION_TIMEOUT_MS' not in journey_api:
    journey_api = journey_api.replace(
        "import api from './api';\n\n",
        "import api from './api';\n\nconst JOURNEY_SESSION_TIMEOUT_MS = 15000;\nconst timeoutConfig = { timeout: JOURNEY_SESSION_TIMEOUT_MS };\n\n",
        1,
    )

journey_api = journey_api.replace("api.post('/journey-sessions/quote', payload)", "api.post('/journey-sessions/quote', payload, timeoutConfig)")
journey_api = journey_api.replace("api.get(`/journey-sessions/quote/${encodeURIComponent(token)}`)", "api.get(`/journey-sessions/quote/${encodeURIComponent(token)}`, timeoutConfig)")
journey_api = journey_api.replace("api.post('/journey-sessions/checkout', payload)", "api.post('/journey-sessions/checkout', payload, timeoutConfig)")
journey_api = journey_api.replace("api.get(`/journey-sessions/checkout/${encodeURIComponent(token)}`)", "api.get(`/journey-sessions/checkout/${encodeURIComponent(token)}`, timeoutConfig)")
journey_api = journey_api.replace("api.patch(`/journey-sessions/checkout/${encodeURIComponent(token)}`, patch)", "api.patch(`/journey-sessions/checkout/${encodeURIComponent(token)}`, patch, timeoutConfig)")
journey_api = journey_api.replace("api.post('/journey-sessions/payment', payload)", "api.post('/journey-sessions/payment', payload, timeoutConfig)")
journey_api = journey_api.replace("api.get(`/journey-sessions/payment/${encodeURIComponent(token)}`)", "api.get(`/journey-sessions/payment/${encodeURIComponent(token)}`, timeoutConfig)")
journey_api = journey_api.replace("api.patch(`/journey-sessions/payment/${encodeURIComponent(token)}`, patch)", "api.patch(`/journey-sessions/payment/${encodeURIComponent(token)}`, patch, timeoutConfig)")
journey_api = journey_api.replace("api.get(`/journey-sessions/reservation/${encodeURIComponent(token)}`)", "api.get(`/journey-sessions/reservation/${encodeURIComponent(token)}`, timeoutConfig)")

booking_path.write_text(booking)
voucher_path.write_text(voucher)
journey_routes_path.write_text(journey_routes)
journey_api_path.write_text(journey_api)
