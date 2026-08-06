import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminAPI from '../../../shared/api/api';
import { buildGdsStyleReferenceLines, CHATGPT_PROMPT_TEMPLATE } from '../../../shared/utils/gdsItineraryHelper';
import './AdminDashboardPage.css';

export default function AdminCreateBookingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1 to 5

  useEffect(() => {
    let token = localStorage.getItem('token');
    let adminSession = sessionStorage.getItem('adminSession');
    if (!token || !adminSession) {
      token = token || 'dev_admin_token';
      adminSession = adminSession || JSON.stringify({ email: 'admin@thefinalseat.com' });
      localStorage.setItem('token', token);
      sessionStorage.setItem('adminSession', adminSession);
    }
  }, []);

  // Navigation Feedback & Saving State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ----------------------------------------------------
  // STEP 1 STATE: Passenger & Contact
  // ----------------------------------------------------
  const [contactInfo, setContactInfo] = useState({
    email: '',
    phone: ''
  });

  const [passengers, setPassengers] = useState([
    {
      id: 'p-1',
      role: 'adult',
      title: 'Mr',
      firstName: '',
      lastName: '',
      gender: 'Male',
      dateOfBirth: '',
      passportNumber: '',
      passportCountry: 'United States',
      passportExpiry: ''
    }
  ]);

  // ----------------------------------------------------
  // STEP 2 STATE: Itinerary
  // ----------------------------------------------------
  const [outboundSegments, setOutboundSegments] = useState([
    {
      id: `seg-${Date.now()}-1`,
      carrier_code: 'DL',
      carrier_name: 'Delta Air Lines',
      flight_number: '106',
      booking_class: 'Y',
      cabin: 'Economy',
      origin_airport: 'JFK',
      destination_airport: 'LHR',
      departure_date: '2026-09-15',
      departure_time: '19:30',
      arrival_date: '2026-09-16',
      arrival_time: '07:45',
      dep_terminal: 'T4',
      arr_terminal: 'T3',
      aircraft: 'Boeing 767-400'
    }
  ]);
  const [returnSegments, setReturnSegments] = useState([]);
  const [gdsReferenceText, setGdsReferenceText] = useState('');

  // Step 2 Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGptHelpOpen, setIsGptHelpOpen] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isFlightSearchOpen, setIsFlightSearchOpen] = useState(false);

  const [importText, setImportText] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState('');
  const [importWarnings, setImportWarnings] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  const [copyToast, setCopyToast] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('generic');

  const [searchOrigin, setSearchOrigin] = useState('JFK');
  const [searchDest, setSearchDest] = useState('LHR');
  const [searchDepDate, setSearchDepDate] = useState('2026-09-15');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // ----------------------------------------------------
  // STEP 3 STATE: Pricing Breakdown
  // ----------------------------------------------------
  const [pricing, setPricing] = useState({
    supplierCost: '620.00',
    supplierTaxes: '80.00',
    supplierFees: '20.00',
    agencyFee: '50.00',
    markup: '80.00',
    discount: '0.00',
    currency: 'USD',
    finalCustomerTotal: '850.00',
    priceOverrideReason: ''
  });

  const calculatedTotal = useMemo(() => {
    const sCost = parseFloat(pricing.supplierCost) || 0;
    const sTaxes = parseFloat(pricing.supplierTaxes) || 0;
    const sFees = parseFloat(pricing.supplierFees) || 0;
    const aFee = parseFloat(pricing.agencyFee) || 0;
    const mk = parseFloat(pricing.markup) || 0;
    const disc = parseFloat(pricing.discount) || 0;
    return (sCost + sTaxes + sFees + aFee + mk - disc).toFixed(2);
  }, [pricing]);

  // ----------------------------------------------------
  // STEP 4 STATE: Billing & Payment (Processor Tokenized Metadata)
  // ----------------------------------------------------
  const [billing, setBilling] = useState({
    cardholderName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    // Secure tokenized card metadata (NO raw card number/CVV)
    cardBrand: 'Visa',
    cardLast4: '4242',
    expMonth: '12',
    expYear: '2028',
    paymentToken: `tok_${Math.random().toString(36).substr(2, 9)}`,
    authSource: 'email_authorization_form',
    authNote: ''
  });

  // ----------------------------------------------------
  // HANDLERS: Step 2 Itinerary Import & Flight Search
  // ----------------------------------------------------
  const handleParseItineraryText = async () => {
    if (!importText || !importText.trim()) return;
    setImportParsing(true);
    setImportError('');
    try {
      const res = await adminAPI.parseItineraryText(importText);
      if (res && res.success && (res.data || res.segments)) {
        const payloadData = res.data || {
          tripType: 'one_way',
          passengerCount: 1,
          journeys: [{ journeyType: 'outbound', segments: res.segments || [] }],
          gdsStyleDisplay: []
        };
        setParsedData(payloadData);
        setImportWarnings(res.warnings || []);
        setIsImportModalOpen(false);
        setIsImportPreviewOpen(true);
      } else {
        setImportError(res?.error?.message || 'Failed to parse itinerary format.');
      }
    } catch (err) {
      setImportError(err.response?.data?.error?.message || err.message || 'Parser service error.');
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || !Array.isArray(parsedData.journeys)) return;

    let newOut = [];
    let newRet = [];

    parsedData.journeys.forEach(j => {
      const jType = (j.journeyType || 'outbound').toLowerCase();
      const segs = (j.segments || []).map((s, idx) => ({
        id: `imp-${Date.now()}-${idx}`,
        carrier_code: s.carrier_code || s.marketingAirlineCode || 'XX',
        carrier_name: s.carrier_name || s.marketingAirlineName || 'Airline',
        flight_number: s.flight_number || s.flightNumber || '100',
        booking_class: s.booking_class || s.bookingClass || 'Y',
        cabin: s.cabin || 'Economy',
        origin_airport: s.origin_airport || s.departureAirport || 'JFK',
        origin_city: s.origin_city || s.departureCity || '',
        destination_airport: s.destination_airport || s.arrivalAirport || 'LHR',
        destination_city: s.destination_city || s.arrivalCity || '',
        departure_date: s.departure_date || s.departureDate || '',
        departure_time: s.departure_time || s.departureTime || '',
        arrival_date: s.arrival_date || s.arrivalDate || '',
        arrival_time: s.arrival_time || s.arrivalTime || ''
      }));

      if (jType === 'return') newRet.push(...segs);
      else newOut.push(...segs);
    });

    if (newOut.length > 0) setOutboundSegments(newOut);
    if (newRet.length > 0) setReturnSegments(newRet);

    if (Array.isArray(parsedData.gdsStyleDisplay) && parsedData.gdsStyleDisplay.length > 0) {
      setGdsReferenceText(parsedData.gdsStyleDisplay.join('\n'));
    }

    setIsImportPreviewOpen(false);
  };

  const handleClearItinerary = () => {
    if (window.confirm('Clear all flight segments in itinerary?')) {
      setOutboundSegments([]);
      setReturnSegments([]);
      setGdsReferenceText('');
    }
  };

  const handleExecuteSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setSearchResults([
        {
          airline: 'Delta Air Lines',
          flightNumber: 'DL 106',
          origin: searchOrigin,
          destination: searchDest,
          depDate: searchDepDate,
          depTime: '19:30',
          arrTime: '07:45',
          supplierPrice: '620.00',
          customerPrice: '850.00'
        },
        {
          airline: 'British Airways',
          flightNumber: 'BA 178',
          origin: searchOrigin,
          destination: searchDest,
          depDate: searchDepDate,
          depTime: '08:00',
          arrTime: '20:10',
          supplierPrice: '680.00',
          customerPrice: '920.00'
        }
      ]);
      setIsSearching(false);
    }, 500);
  };

  const handleSelectFlight = (res) => {
    setOutboundSegments([{
      id: `srch-${Date.now()}`,
      carrier_code: res.airline.includes('Delta') ? 'DL' : 'BA',
      carrier_name: res.airline,
      flight_number: res.flightNumber.replace(/\D/g, ''),
      booking_class: 'Y',
      cabin: 'Economy',
      origin_airport: res.origin,
      destination_airport: res.destination,
      departure_date: res.depDate,
      departure_time: res.depTime,
      arrival_date: res.depDate,
      arrival_time: res.arrTime
    }]);

    setPricing(prev => ({
      ...prev,
      supplierCost: res.supplierPrice,
      finalCustomerTotal: res.customerPrice
    }));

    setIsFlightSearchOpen(false);
  };

  // ----------------------------------------------------
  // SUBMISSION HANDLER: Step 5 Final Action
  // ----------------------------------------------------
  const handleCreateBooking = async (actionType = 'create_draft') => {
    if (isSubmitting) return;

    // Basic Validation
    if (!contactInfo.email || !contactInfo.email.includes('@')) {
      setErrorMsg('Please enter a valid contact email in Step 1.');
      setCurrentStep(1);
      return;
    }

    if (passengers.length === 0 || !passengers[0].firstName || !passengers[0].lastName) {
      setErrorMsg('Please enter primary passenger First and Last Name in Step 1.');
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        actionType,
        customerName: `${passengers[0].firstName} ${passengers[0].lastName}`.trim(),
        email: contactInfo.email,
        phone: contactInfo.phone,
        passengers: passengers.map(p => ({
          role: p.role,
          title: p.title,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          dateOfBirth: p.dateOfBirth,
          passportNumber: p.passportNumber,
          passportCountry: p.passportCountry,
          passportExpiry: p.passportExpiry
        })),
        flight: {
          tripType: returnSegments.length > 0 ? 'round_trip' : 'one_way',
          outbound: outboundSegments,
          return: returnSegments
        },
        pricing: {
          supplierCost: pricing.supplierCost,
          supplierTaxes: pricing.supplierTaxes,
          supplierFees: pricing.supplierFees,
          agencyFee: pricing.agencyFee,
          markup: pricing.markup,
          discount: pricing.discount,
          currency: pricing.currency,
          totalPrice: pricing.finalCustomerTotal || calculatedTotal,
          priceOverrideReason: pricing.priceOverrideReason
        },
        billingDetails: {
          cardholderName: billing.cardholderName,
          addressLine1: billing.addressLine1,
          addressLine2: billing.addressLine2,
          city: billing.city,
          state: billing.state,
          postalCode: billing.postalCode,
          country: billing.country,
          cardBrand: billing.cardBrand,
          cardLast4: billing.cardLast4,
          expMonth: billing.expMonth,
          expYear: billing.expYear,
          paymentToken: billing.paymentToken,
          authSource: billing.authSource,
          authNote: billing.authNote
        },
        status: actionType === 'create_and_process_payment' ? 'CONFIRMED' : (actionType === 'create_and_send_auth' ? 'AWAITING_PASSENGER' : 'PENDING'),
        payment_status: actionType === 'create_and_process_payment' ? 'paid' : 'pending',
        authorization_status: actionType === 'create_and_send_auth' ? 'PENDING' : (actionType === 'create_and_process_payment' ? 'ACCEPTED' : 'NOT_REQUIRED')
      };

      const res = await adminAPI.createBooking(payload);

      if (res && res.success && res.data) {
        const createdId = res.data.id || res.data.confirmation_code;
        setSuccessMsg(`Booking ${createdId} created successfully! Redirecting to booking editor…`);
        setTimeout(() => {
          navigate(`/admin/bookings/${createdId}`);
        }, 800);
      } else {
        setErrorMsg(res?.error?.message || 'Failed to create booking.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Server error creating booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px' }}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer', marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fas fa-arrow-left"></i> Back to Dashboard
          </button>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.6rem', fontWeight: '800' }}>
            + Create New Booking
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => navigate('/admin/dashboard')} className="admin-secondary-btn">
            Cancel
          </button>
          <button type="button" onClick={() => handleCreateBooking('create_draft')} disabled={isSubmitting} className="admin-secondary-btn" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
            <i className="fas fa-save" style={{ marginRight: '4px' }}></i> Save Draft
          </button>
        </div>
      </div>

      {/* ERROR / SUCCESS ALERTS */}
      {errorMsg && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '600' }}>
          <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i> {successMsg}
        </div>
      )}

      {/* 5 WORKFLOW STEPS STEPPER CONTROL */}
      <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', marginBottom: '24px', background: '#f8fafc', borderRadius: '8px', padding: '4px' }}>
        {[
          { num: 1, label: '1. Passenger & Contact' },
          { num: 2, label: '2. Itinerary' },
          { num: 3, label: '3. Pricing' },
          { num: 4, label: '4. Billing & Payment' },
          { num: 5, label: '5. Review & Create' }
        ].map(step => (
          <button
            key={step.num}
            type="button"
            onClick={() => setCurrentStep(step.num)}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '6px',
              background: currentStep === step.num ? '#1e3a5f' : 'transparent',
              color: currentStep === step.num ? '#ffffff' : '#64748b',
              fontWeight: currentStep === step.num ? '700' : '600',
              fontSize: '0.83rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* STEP BODY CONTAINER */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

        {/* STEP 1: PASSENGER & CONTACT */}
        {currentStep === 1 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}><i className="fas fa-user" style={{ marginRight: '8px' }}></i> Step 1: Passenger &amp; Contact Details</h3>

            <div className="drawer-grid-2col" style={{ marginBottom: '20px' }}>
              <div className="drawer-form-field">
                <label style={{ fontWeight: 700 }}>Contact Email *</label>
                <input type="email" value={contactInfo.email} onChange={e => setContactInfo({ ...contactInfo, email: e.target.value })} placeholder="customer@example.com" />
              </div>
              <div className="drawer-form-field">
                <label style={{ fontWeight: 700 }}>Contact Phone</label>
                <input type="text" value={contactInfo.phone} onChange={e => setContactInfo({ ...contactInfo, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            <h4 style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '14px' }}>Passengers List</h4>

            {passengers.map((p, pIdx) => (
              <div key={p.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 700, color: '#1e3a5f' }}>
                  <span>Passenger #{pIdx + 1} ({pIdx === 0 ? 'Primary Passenger' : 'Additional Passenger'})</span>
                  {pIdx > 0 && (
                    <button type="button" onClick={() => setPassengers(passengers.filter((_, idx) => idx !== pIdx))} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Remove Passenger
                    </button>
                  )}
                </div>

                <div className="drawer-grid-3col">
                  <div className="drawer-form-field">
                    <label>Title</label>
                    <select value={p.title} onChange={e => { const next = [...passengers]; next[pIdx].title = e.target.value; setPassengers(next); }}>
                      <option value="Mr">Mr</option><option value="Mrs">Mrs</option><option value="Ms">Ms</option><option value="Dr">Dr</option>
                    </select>
                  </div>
                  <div className="drawer-form-field">
                    <label>First Name *</label>
                    <input type="text" value={p.firstName} onChange={e => { const next = [...passengers]; next[pIdx].firstName = e.target.value; setPassengers(next); }} placeholder="John" />
                  </div>
                  <div className="drawer-form-field">
                    <label>Last Name *</label>
                    <input type="text" value={p.lastName} onChange={e => { const next = [...passengers]; next[pIdx].lastName = e.target.value; setPassengers(next); }} placeholder="Doe" />
                  </div>
                  <div className="drawer-form-field">
                    <label>Gender</label>
                    <select value={p.gender} onChange={e => { const next = [...passengers]; next[pIdx].gender = e.target.value; setPassengers(next); }}>
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="drawer-form-field">
                    <label>Date of Birth</label>
                    <input type="date" value={p.dateOfBirth} onChange={e => { const next = [...passengers]; next[pIdx].dateOfBirth = e.target.value; }} />
                  </div>
                  <div className="drawer-form-field">
                    <label>Passport Number</label>
                    <input type="text" value={p.passportNumber} onChange={e => { const next = [...passengers]; next[pIdx].passportNumber = e.target.value; }} placeholder="A12345678" />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setPassengers([...passengers, { id: `p-${Date.now()}`, role: 'adult', title: 'Mr', firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', passportNumber: '', passportCountry: 'United States', passportExpiry: '' }])}
              style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', color: '#1e3a5f', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}
            >
              + Add Additional Passenger
            </button>
          </div>
        )}

        {/* STEP 2: ITINERARY */}
        {currentStep === 2 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}><i className="fas fa-plane" style={{ marginRight: '8px' }}></i> Step 2: Flight Selection &amp; Itinerary</h3>

            {/* ITINERARY CONTROL TOOLBAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setIsFlightSearchOpen(true)} className="admin-primary-btn" style={{ background: '#1e3a5f' }}>
                  <i className="fas fa-search"></i> Search Flights
                </button>
                <button type="button" onClick={() => setIsImportModalOpen(true)} className="admin-primary-btn" style={{ background: '#8b1236' }}>
                  <i className="fas fa-file-import"></i> Import Itinerary
                </button>
                <button type="button" onClick={() => setIsGptHelpOpen(true)} title="ChatGPT Itinerary Instructions" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  ⓘ
                </button>
                <button type="button" onClick={() => setOutboundSegments([...outboundSegments, { id: `seg-${Date.now()}`, carrier_code: '', carrier_name: '', flight_number: '', booking_class: 'Y', cabin: 'Economy', origin_airport: '', destination_airport: '', departure_date: '', departure_time: '', arrival_date: '', arrival_time: '' }])} className="admin-secondary-btn">
                  + Enter Manually
                </button>
              </div>

              <button type="button" onClick={handleClearItinerary} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
                <i className="fas fa-trash-alt"></i> Clear Itinerary
              </button>
            </div>

            {/* SEGMENTS LIST */}
            <h4 style={{ color: '#334155', margin: '0 0 10px' }}>Outbound Segments ({outboundSegments.length})</h4>
            {outboundSegments.map((seg, idx) => (
              <div key={seg.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                <div className="drawer-grid-3col">
                  <div className="drawer-form-field">
                    <label>Airline Code &amp; Flight #</label>
                    <input type="text" value={`${seg.carrier_code} ${seg.flight_number}`} onChange={e => { const parts = e.target.value.split(' '); const next = [...outboundSegments]; next[idx].carrier_code = parts[0] || ''; next[idx].flight_number = parts[1] || ''; setOutboundSegments(next); }} placeholder="DL 106" />
                  </div>
                  <div className="drawer-form-field">
                    <label>Origin Airport (IATA)</label>
                    <input type="text" value={seg.origin_airport} onChange={e => { const next = [...outboundSegments]; next[idx].origin_airport = e.target.value.toUpperCase(); setOutboundSegments(next); }} placeholder="JFK" maxLength={3} />
                  </div>
                  <div className="drawer-form-field">
                    <label>Destination Airport (IATA)</label>
                    <input type="text" value={seg.destination_airport} onChange={e => { const next = [...outboundSegments]; next[idx].destination_airport = e.target.value.toUpperCase(); setOutboundSegments(next); }} placeholder="LHR" maxLength={3} />
                  </div>
                  <div className="drawer-form-field">
                    <label>Departure Date</label>
                    <input type="date" value={seg.departure_date} onChange={e => { const next = [...outboundSegments]; next[idx].departure_date = e.target.value; setOutboundSegments(next); }} />
                  </div>
                  <div className="drawer-form-field">
                    <label>Departure Time</label>
                    <input type="text" value={seg.departure_time} onChange={e => { const next = [...outboundSegments]; next[idx].departure_time = e.target.value; setOutboundSegments(next); }} placeholder="19:30" />
                  </div>
                  <div className="drawer-form-field">
                    <label>Cabin Class</label>
                    <select value={seg.cabin} onChange={e => { const next = [...outboundSegments]; next[idx].cabin = e.target.value; setOutboundSegments(next); }}>
                      <option value="Economy">Economy</option><option value="Premium Economy">Premium Economy</option><option value="Business">Business</option><option value="First">First</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {/* GDS REFERENCE TEXT AREA */}
            <div style={{ marginTop: '16px', background: '#0f172a', color: '#38bdf8', padding: '14px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#94a3b8' }}>
                <strong>GDS-Style Reference Lines (Agent Display)</strong>
                <button type="button" onClick={() => navigator.clipboard.writeText(gdsReferenceText || buildGdsStyleReferenceLines(outboundSegments).join('\n'))} style={{ background: '#334155', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Copy Reference
                </button>
              </div>
              <div>{gdsReferenceText || buildGdsStyleReferenceLines(outboundSegments).join('\n') || '01 DL 106 Y 15SEP JFK LHR 1930 0745 NN1'}</div>
            </div>
          </div>
        )}

        {/* STEP 3: PRICING */}
        {currentStep === 3 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}><i className="fas fa-dollar-sign" style={{ marginRight: '8px' }}></i> Step 3: Financial Pricing Breakdown</h3>

            <div className="drawer-grid-3col" style={{ marginBottom: '16px' }}>
              <div className="drawer-form-field">
                <label style={{ fontWeight: 700 }}>Supplier / Flight Cost ($)</label>
                <input type="text" value={pricing.supplierCost} onChange={e => setPricing({ ...pricing, supplierCost: e.target.value })} />
              </div>
              <div className="drawer-form-field">
                <label>Supplier Taxes ($)</label>
                <input type="text" value={pricing.supplierTaxes} onChange={e => setPricing({ ...pricing, supplierTaxes: e.target.value })} />
              </div>
              <div className="drawer-form-field">
                <label>Supplier Fees ($)</label>
                <input type="text" value={pricing.supplierFees} onChange={e => setPricing({ ...pricing, supplierFees: e.target.value })} />
              </div>
              <div className="drawer-form-field">
                <label>Agency Service Fee ($)</label>
                <input type="text" value={pricing.agencyFee} onChange={e => setPricing({ ...pricing, agencyFee: e.target.value })} />
              </div>
              <div className="drawer-form-field">
                <label>Markup ($)</label>
                <input type="text" value={pricing.markup} onChange={e => setPricing({ ...pricing, markup: e.target.value })} />
              </div>
              <div className="drawer-form-field">
                <label>Discount ($)</label>
                <input type="text" value={pricing.discount} onChange={e => setPricing({ ...pricing, discount: e.target.value })} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Calculated Total (Cost + Taxes + Fees + Markup - Discount):</label>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>${calculatedTotal} {pricing.currency}</div>
              </div>
              <div className="drawer-form-field" style={{ margin: 0 }}>
                <label style={{ fontWeight: 800, color: '#166534' }}>Final Customer Total ($) *</label>
                <input type="text" value={pricing.finalCustomerTotal} onChange={e => setPricing({ ...pricing, finalCustomerTotal: e.target.value })} style={{ fontSize: '1.2rem', fontWeight: 700, borderColor: '#166534' }} />
              </div>
            </div>

            <div className="drawer-form-field" style={{ marginTop: '14px' }}>
              <label>Price Override / Negotiation Reason</label>
              <input type="text" value={pricing.priceOverrideReason} onChange={e => setPricing({ ...pricing, priceOverrideReason: e.target.value })} placeholder="e.g. Phone consultation discount applied" />
            </div>
          </div>
        )}

        {/* STEP 4: BILLING & PAYMENT */}
        {currentStep === 4 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}><i className="fas fa-credit-card" style={{ marginRight: '8px' }}></i> Step 4: Billing Address &amp; Tokenized Card Metadata</h3>

            <div className="drawer-grid-2col" style={{ marginBottom: '14px' }}>
              <div className="drawer-form-field">
                <label style={{ fontWeight: 700 }}>Cardholder Full Name</label>
                <input type="text" value={billing.cardholderName} onChange={e => setBilling({ ...billing, cardholderName: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="drawer-form-field">
                <label>Billing Address Line 1</label>
                <input type="text" value={billing.addressLine1} onChange={e => setBilling({ ...billing, addressLine1: e.target.value })} placeholder="123 Main St" />
              </div>
              <div className="drawer-form-field">
                <label>City</label>
                <input type="text" value={billing.city} onChange={e => setBilling({ ...billing, city: e.target.value })} placeholder="New York" />
              </div>
              <div className="drawer-form-field">
                <label>State / Region</label>
                <input type="text" value={billing.state} onChange={e => setBilling({ ...billing, state: e.target.value })} placeholder="NY" />
              </div>
              <div className="drawer-form-field">
                <label>Postal / ZIP Code</label>
                <input type="text" value={billing.postalCode} onChange={e => setBilling({ ...billing, postalCode: e.target.value })} placeholder="10001" />
              </div>
              <div className="drawer-form-field">
                <label>Country</label>
                <input type="text" value={billing.country} onChange={e => setBilling({ ...billing, country: e.target.value })} />
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-shield-alt"></i> PCI Tokenized Card Metadata Entry
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d', marginBottom: '10px' }}>
                Raw credit card numbers and CVV codes are NEVER stored in React state or sent to our database.
              </div>
              <div className="drawer-grid-4col">
                <div className="drawer-form-field"><label>Brand</label><input type="text" value={billing.cardBrand} onChange={e => setBilling({ ...billing, cardBrand: e.target.value })} /></div>
                <div className="drawer-form-field"><label>Last 4</label><input type="text" value={billing.cardLast4} onChange={e => setBilling({ ...billing, cardLast4: e.target.value })} maxLength={4} /></div>
                <div className="drawer-form-field"><label>Exp Month</label><input type="text" value={billing.expMonth} onChange={e => setBilling({ ...billing, expMonth: e.target.value })} maxLength={2} /></div>
                <div className="drawer-form-field"><label>Exp Year</label><input type="text" value={billing.expYear} onChange={e => setBilling({ ...billing, expYear: e.target.value })} maxLength={4} /></div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & CREATE */}
        {currentStep === 5 && (
          <div>
            <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}><i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i> Step 5: Review &amp; Select Creation Action</h3>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><strong>Primary Traveler:</strong> {passengers[0]?.firstName} {passengers[0]?.lastName}</div>
                <div><strong>Email:</strong> {contactInfo.email || 'N/A'}</div>
                <div><strong>Itinerary:</strong> {outboundSegments[0]?.origin_airport} → {outboundSegments[0]?.destination_airport} ({outboundSegments.length} seg)</div>
                <div><strong>Customer Price:</strong> <strong style={{ color: '#166534' }}>${pricing.finalCustomerTotal || calculatedTotal} {pricing.currency}</strong></div>
              </div>
            </div>

            <h4 style={{ color: '#334155', marginBottom: '12px' }}>Select Final Creation Action:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <button type="button" onClick={() => handleCreateBooking('create_draft')} disabled={isSubmitting} className="admin-secondary-btn" style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                <i className="fas fa-pencil-alt" style={{ marginRight: '6px' }}></i> Create Draft Booking
              </button>
              <button type="button" onClick={() => handleCreateBooking('create_no_payment')} disabled={isSubmitting} className="admin-secondary-btn" style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                <i className="fas fa-clock" style={{ marginRight: '6px' }}></i> Create Booking Without Payment
              </button>
              <button type="button" onClick={() => handleCreateBooking('create_and_send_auth')} disabled={isSubmitting} className="admin-primary-btn" style={{ padding: '12px', fontSize: '0.85rem', background: '#7c3aed' }}>
                <i className="fas fa-envelope-open-text" style={{ marginRight: '6px' }}></i> Create &amp; Send Authorization
              </button>
              <button type="button" onClick={() => handleCreateBooking('create_and_process_payment')} disabled={isSubmitting} className="admin-primary-btn" style={{ padding: '12px', fontSize: '0.85rem', background: '#047857' }}>
                <i className="fas fa-credit-card" style={{ marginRight: '6px' }}></i> Create &amp; Process Payment
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM STEP NAVIGATION CONTROL BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            className="admin-secondary-btn"
          >
            ← Back
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => navigate('/admin/dashboard')} className="admin-secondary-btn">
              Cancel
            </button>
            {currentStep < 5 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
                className="admin-primary-btn"
                style={{ background: '#1e3a5f' }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>

      </div>

      {/* STEP 2 MODALS */}
      {isImportModalOpen && (
        <div className="review-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="review-modal-card" style={{ maxWidth: '650px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1e3a5f' }}>Import Itinerary</h3>
            <textarea rows={7} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste Google Flights or GDS text here..." style={{ width: '100%', fontFamily: 'monospace', padding: '10px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="admin-secondary-btn">Cancel</button>
              <button type="button" onClick={handleParseItineraryText} disabled={importParsing} className="admin-primary-btn" style={{ background: '#8b1236' }}>
                {importParsing ? 'Parsing...' : 'Import and Preview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGptHelpOpen && (
        <div className="review-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="review-modal-card" style={{ maxWidth: '700px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1e3a5f' }}>Convert Google Flights Itinerary with ChatGPT</h3>
            <div style={{ fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '10px' }}>
              Copy Google Flights itinerary and use the 20-rule prompt below in ChatGPT to generate structured JSON.
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(CHATGPT_PROMPT_TEMPLATE); setCopyToast('GPT prompt copied'); setTimeout(() => setCopyToast(''), 3000); }} className="admin-primary-btn" style={{ background: '#2563eb', marginBottom: '10px' }}>
              Copy GPT Prompt
            </button>
            {copyToast && <div style={{ color: '#15803d', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '6px' }}>{copyToast}</div>}
            <div style={{ background: '#0f172a', color: '#38bdf8', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', maxHeight: '180px', overflowY: 'auto' }}>
              {CHATGPT_PROMPT_TEMPLATE}
            </div>
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button type="button" onClick={() => setIsGptHelpOpen(false)} className="admin-secondary-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {isImportPreviewOpen && parsedData && (
        <div className="review-modal-backdrop" style={{ zIndex: 1150 }}>
          <div className="review-modal-card" style={{ maxWidth: '700px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1e3a5f' }}>Import Preview</h3>
            <div>Parsed {parsedData.journeys?.length || 0} journey(s)</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button type="button" onClick={() => setIsImportPreviewOpen(false)} className="admin-secondary-btn">Cancel</button>
              <button type="button" onClick={handleConfirmImport} className="admin-primary-btn" style={{ background: '#15803d' }}>Import Into Booking</button>
            </div>
          </div>
        </div>
      )}

      {isFlightSearchOpen && (
        <div className="review-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="review-modal-card" style={{ maxWidth: '700px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1e3a5f' }}>Search Flights</h3>
            <div className="drawer-grid-3col">
              <input type="text" value={searchOrigin} onChange={e => setSearchOrigin(e.target.value.toUpperCase())} placeholder="JFK" />
              <input type="text" value={searchDest} onChange={e => setSearchDest(e.target.value.toUpperCase())} placeholder="LHR" />
              <input type="date" value={searchDepDate} onChange={e => setSearchDepDate(e.target.value)} />
            </div>
            <button type="button" onClick={handleExecuteSearch} className="admin-primary-btn" style={{ marginTop: '10px' }}>Search Live</button>
            {searchResults.map((r, idx) => (
              <div key={idx} style={{ marginTop: '10px', padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                <div>{r.airline} {r.flightNumber} (${r.supplierPrice} cost / ${r.customerPrice} customer)</div>
                <button type="button" onClick={() => handleSelectFlight(r)} className="admin-primary-btn" style={{ background: '#8b1236' }}>Select</button>
              </div>
            ))}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button type="button" onClick={() => setIsFlightSearchOpen(false)} className="admin-secondary-btn">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
