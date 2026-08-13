from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def must_replace(text, old, new, label, count=1):
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f'{label}: expected at least {count} occurrence(s), found {actual}')
    return text.replace(old, new, count)

# ── booking.repository.mjs: database-authoritative, fail-closed writes ─────────
path = 'backend/src/modules/bookings/booking.repository.mjs'
s = read(path)
s = must_replace(
    s,
    "    const clientReqId = dbRow.client_request_id || dbRow.clientRequestId || null;\n    const { client_request_id, ...cleanDbRow } = dbRow;\n",
    "    const clientReqId = dbRow.client_request_id || dbRow.clientRequestId || dbRow.idempotency_key || dbRow.idempotencyKey || null;\n    const cleanDbRow = {\n      ...dbRow,\n      client_request_id: clientReqId,\n      idempotency_key: dbRow.idempotency_key || dbRow.idempotencyKey || clientReqId || null,\n    };\n",
    'persist client request id'
)

start = s.index("    if (error) {\n      // Resilience fallback for schema cache delays on remote database")
end = s.index("    if (data) {", start)
s = s[:start] + "    if (error) {\n      const insertError = new Error(`Booking record insert failed: ${error.message}`);\n      insertError.code = 'BOOKING_INSERT_FAILED';\n      throw insertError;\n    }\n" + s[end:]

contact_start = s.index("  insertContact: async (contactRow) => {")
contact_end = s.index("  insertFlights: async (flightRows) => {", contact_start)
contact_new = """  insertContact: async (contactRow) => {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contactRow)
      .select();

    if (error) {
      const insertError = new Error(`Contact record insert failed: ${error.message}`);
      insertError.code = 'CONTACT_INSERT_FAILED';
      throw insertError;
    }
    if (!Array.isArray(data) || data.length === 0) {
      const insertError = new Error('Contact record insert failed: database returned no persisted contact.');
      insertError.code = 'CONTACT_INSERT_FAILED';
      throw insertError;
    }
    return data;
  },

"""
s = s[:contact_start] + contact_new + s[contact_end:]

payment_start = s.index("  insertPayment: async (paymentRow) => {")
payment_end = s.index("  getRelations: async (bookingId) => {", payment_start)
payment_new = """  insertPayment: async (paymentRow) => {
    const canonicalStatus = String(paymentRow.payment_status || 'PENDING').trim().toUpperCase();
    const allowedStatuses = new Set(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED']);
    const normalizedRow = {
      ...paymentRow,
      payment_status: allowedStatuses.has(canonicalStatus) ? canonicalStatus : 'PENDING',
      currency: String(paymentRow.currency || 'USD').trim().toUpperCase(),
    };

    const { data, error } = await supabase
      .from('payments')
      .insert(normalizedRow)
      .select();

    if (error) {
      const insertError = new Error(`Payment record insert failed: ${error.message}`);
      insertError.code = 'PAYMENT_INSERT_FAILED';
      throw insertError;
    }
    if (!Array.isArray(data) || data.length === 0) {
      const insertError = new Error('Payment record insert failed: database returned no persisted payment.');
      insertError.code = 'PAYMENT_INSERT_FAILED';
      throw insertError;
    }
    return data;
  },

"""
s = s[:payment_start] + payment_new + s[payment_end:]

s = must_replace(
    s,
    ".select('*')\n        .or(`client_request_id.eq.${clientRequestId},idempotency_key.eq.${clientRequestId}`)",
    ".select('id,confirmation_code,status,payment_status,total_amount,customer_price,supplier_price,currency,passenger_name,email,phone,client_request_id,idempotency_key,created_at,updated_at')\n        .or(`client_request_id.eq.${clientRequestId},idempotency_key.eq.${clientRequestId}`)",
    'idempotency lightweight select'
)
write(path, s)

# ── booking.service.mjs: canonical statuses, contact integrity, infant subtype ──
path = 'backend/src/modules/bookings/booking.service.mjs'
s = read(path)
s = must_replace(s, "      paymentStatus: isDraft ? 'draft' : (payload.paymentStatus || 'pending'),", "      paymentStatus: 'PENDING',", 'service booking payment status')
s = must_replace(
    s,
    "            passport_expiry: p.passportExpiry || null,\n",
    "            passport_expiry: p.passportExpiry || null,\n            infant_type: (p.role || '').toLowerCase() === 'infant'\n              ? (String(p.infantType || p.infant_type || '').toUpperCase() || null)\n              : null,\n",
    'persist infant type'
)
s = must_replace(
    s,
    "      const rawPhone = String(payload.phone || '').trim();\n      const countryCode = rawPhone.startsWith('+') ? rawPhone.split(' ')[0] : null;\n      const contactRow = {",
    "      const rawPhone = String(payload.phone || '').trim();\n      const contactEmail = String(payload.email || '').trim().toLowerCase();\n      if (!contactEmail || !rawPhone) {\n        const contactError = new Error('A valid primary contact email and phone number are required.');\n        contactError.code = 'CONTACT_REQUIRED';\n        throw contactError;\n      }\n      // Only persist a separate country code when the input explicitly separates it\n      // (for example '+1 7165550123'). Never mistake the whole E.164 phone for a code.\n      const countryCode = rawPhone.match(/^(\\+\\d{1,4})\\s+/)?.[1] || null;\n      const contactRow = {",
    'safe contact code parsing'
)
s = must_replace(s, "        email: payload.email,", "        email: contactEmail,", 'contact normalized email')
s = must_replace(s, "        payment_status: isDraft ? 'draft' : (payload.paymentStatus || 'pending'),", "        payment_status: 'PENDING',", 'service payment row status')
write(path, s)

# ── booking.mapper.mjs: canonical status + durable idempotency + infant type ───
path = 'backend/src/modules/bookings/booking.mapper.mjs'
s = read(path)
s = must_replace(s, "      payment_status: payload.paymentStatus || 'pending',", "      payment_status: String(payload.paymentStatus || 'PENDING').toUpperCase(),", 'mapper payment status')
s = must_replace(
    s,
    "      client_request_id: clientReqId,\n",
    "      client_request_id: clientReqId,\n      idempotency_key: clientReqId,\n",
    'mapper idempotency key'
)
s = must_replace(
    s,
    "        passportExpiry: t.passport_expiry\n",
    "        passportExpiry: t.passport_expiry,\n        infantType: t.infant_type || null\n",
    'canonical infant type'
)
write(path, s)

# ── traveller.service.mjs: align required UI fields with server validation ─────
path = 'backend/src/modules/travellers/traveller.service.mjs'
s = read(path)
s = must_replace(
    s,
    "      if (!traveler.firstName || !traveler.firstName.trim()) {\n",
    "      if (!traveler.title || !String(traveler.title).trim()) {\n        throw travellerValidationError(`Title is required for ${name}.`);\n      }\n      if (!traveler.firstName || !traveler.firstName.trim()) {\n",
    'require title server side'
)
s = must_replace(
    s,
    "      if (!traveler.lastName || !traveler.lastName.trim()) {\n        throw travellerValidationError(`Last name is required for ${name}.`);\n      }\n\n      // Date of birth validation",
    "      if (!traveler.lastName || !traveler.lastName.trim()) {\n        throw travellerValidationError(`Last name is required for ${name}.`);\n      }\n      if (!traveler.gender || !String(traveler.gender).trim()) {\n        throw travellerValidationError(`Gender is required for ${name}.`);\n      }\n\n      const role = String(traveler.role || 'adult').toLowerCase();\n      if (role === 'infant') {\n        const infantType = String(traveler.infantType || traveler.infant_type || '').toUpperCase();\n        if (infantType && !['IN_SEAT', 'ON_LAP'].includes(infantType)) {\n          throw travellerValidationError(`Invalid infant travel type for ${name}.`);\n        }\n      }\n\n      // Date of birth validation",
    'require gender and validate infant type'
)
write(path, s)

# ── BookingPage.js: passenger counts, safe card metadata, stable submission ─────
path = 'frontend/src/features/bookings/pages/BookingPage.js'
s = read(path)
s = must_replace(
    s,
    "    const adults = parseInt(searchParams.adults || 1, 10);\n    const children = parseInt(searchParams.children || 0, 10);\n    const infants = parseInt(searchParams.infants || 0, 10);\n\n    const initialList = [];\n",
    "    const adults = parseInt(searchParams.adults || 1, 10);\n    const children = parseInt(searchParams.children || 0, 10);\n    const infantsInSeat = parseInt(searchParams.infantsInSeat || 0, 10);\n    const infantsOnLap = parseInt(searchParams.infantsOnLap || 0, 10);\n    const legacyInfants = parseInt(searchParams.infants || 0, 10);\n    const explicitInfants = infantsInSeat + infantsOnLap;\n    const infants = explicitInfants > 0 ? explicitInfants : legacyInfants;\n\n    const initialList = [];\n",
    'explicit infant counts'
)
s = must_replace(
    s,
    "    for (let i = 0; i < infants; i++) {\n      initialList.push(createPassenger('infant'));\n    }\n",
    "    if (explicitInfants > 0) {\n      for (let i = 0; i < infantsInSeat; i++) initialList.push(createPassenger('infant', 'IN_SEAT'));\n      for (let i = 0; i < infantsOnLap; i++) initialList.push(createPassenger('infant', 'ON_LAP'));\n    } else {\n      for (let i = 0; i < infants; i++) initialList.push(createPassenger('infant', 'ON_LAP'));\n    }\n",
    'infant passenger initialization'
)
s = must_replace(s, "  function createPassenger(role) {", "  function createPassenger(role, infantType = null) {", 'createPassenger signature')
s = must_replace(s, "      redressNumber: '',\n    };", "      redressNumber: '',\n      infantType: role === 'infant' ? infantType : null,\n    };", 'createPassenger infant field')
s = must_replace(
    s,
    "  const isStep1Complete = passengersList.length > 0 && passengersList.every(p => \n    !!(p.firstName && p.firstName.trim() && p.lastName && p.lastName.trim() && p.gender && p.dateOfBirth)\n  );",
    "  const isStep1Complete = passengersList.length > 0 && passengersList.every(p =>\n    !!(p.title && p.firstName && p.firstName.trim() && p.lastName && p.lastName.trim() && p.gender && p.dateOfBirth)\n  );",
    'step1 title validation'
)

old_validate_prefix = """  const validateForm = () => {
    if (!isStep2Complete) {
      setError('Please fill in all primary contact details (First Name, Last Name, Email, Phone).');
      setOpenSections({ travellers: false, contact: true, requests: false, payment: false });
      return false;
    }

    if (!isStep1Complete) {
      setError('Please complete all required fields for all travelers (First Name, Last Name, Gender, DOB).');
      setOpenSections({ travellers: true, contact: false, requests: false, payment: false });
      return false;
    }
"""
new_validate_prefix = """  const validateForm = () => {
    if (!isStep1Complete) {
      setError('Please complete all required fields for all travelers (Title, First Name, Last Name, Gender, DOB).');
      setOpenSections({ travellers: true, contact: false, requests: false, payment: false });
      window.setTimeout(() => document.querySelector('.passenger-card-block select:invalid, .passenger-card-block input:invalid')?.focus(), 80);
      return false;
    }

    if (!isStep2Complete) {
      setError('Please fill in all primary contact details (First Name, Last Name, Email, Phone).');
      setOpenSections({ travellers: false, contact: true, requests: false, payment: false });
      window.setTimeout(() => document.querySelector('#contact-email, #contact-phone')?.focus(), 80);
      return false;
    }
"""
s = must_replace(s, old_validate_prefix, new_validate_prefix, 'validation ordering')

s = must_replace(
    s,
    "  const idempotencyKeyRef = useRef(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);",
    "  const idempotencyKeyRef = useRef(\n    sessionStorage.getItem('checkoutSessionToken')\n      ? `checkout:${sessionStorage.getItem('checkoutSessionToken')}`\n      : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`\n  );",
    'stable checkout idempotency'
)
s = must_replace(
    s,
    "    const cleanCardNum = cardForm.cardNumber.replace(/\\D/g, '');\n    const cardLast4 = cleanCardNum || null;\n    const cardBrand = detectCardBrand(cardForm.cardNumber).name;\n    console.log(\n      {cleanCardNum},\n      {cardLast4},\n      {cardBrand}\n    )\n",
    "    const cleanCardNum = cardForm.cardNumber.replace(/\\D/g, '');\n    const cardLast4 = cleanCardNum.length >= 4 ? cleanCardNum.slice(-4) : null;\n    const cardBrand = detectCardBrand(cardForm.cardNumber).name;\n",
    'card last4 only'
)
s = must_replace(s, "      paymentStatus: 'pending',", "      paymentStatus: 'PENDING',", 'frontend canonical payment status')

old_nav = """      // 3. Navigate to dedicated reservation confirmation page
      navigate(`/booking-confirmed/${encodeURIComponent(bCode)}?email=${encodeURIComponent(primaryContact.email)}`);
"""
new_nav = """      // 3. Prefer the opaque reservation-read token when the backend issued one.
      const readToken = pending.reservationReadToken || sessionStorage.getItem(`reservationReadToken:${bCode}`) || null;
      const confirmationRef = readToken || bCode;
      navigate(`/booking-confirmed/${encodeURIComponent(confirmationRef)}?email=${encodeURIComponent(primaryContact.email)}`);
"""
s = must_replace(s, old_nav, new_nav, 'confirmation read token navigation')

old_return = """        return { id: bId, code: bCode };
"""
new_return = """        return {
          id: bId,
          code: bCode,
          reservationReadToken: res?.reservationReadToken || res?.data?.reservationReadToken || null,
        };
"""
s = must_replace(s, old_return, new_return, 'pending booking read token')
write(path, s)

print('booking integrity full patch applied')
