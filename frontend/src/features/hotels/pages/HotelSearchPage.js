import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import HeroSlider from '../../../shared/components/HeroSlider';
import ProductSearchCard from '../../../shared/components/ProductSearchCard';
import SeamlessAdvisorySection from '../../../shared/components/SeamlessAdvisorySection';
import hotelApi from '../hotelApi';
import './HotelSearchPage.css';

const day = (offset) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const hotelHeroSlides = [
  {
    id: 'hotel-search-1',
    eyebrow: 'The Final Seat — Hotel Search & Booking Assistance',
    title: 'Search Hotels. Keep Every Request Trackable.',
    lead: 'Compare live hotel options and send your selected stay directly into our travel team workflow.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80'
  },
  {
    id: 'hotel-search-2',
    eyebrow: 'Hotels, Resorts & Vacation Stays',
    title: 'Find the Right Stay for Your Trip',
    lead: 'Search by destination, dates and guests, then request the property you want without losing the booking trail.',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80'
  }
];

const heroOffer = {
  label: 'LIVE SEARCH',
  highlight: 'Google Hotels results',
  detail: 'Booking requests are handled by The Final Seat'
};

const AMENITY_FILTERS = ['Free Wi-Fi', 'Breakfast', 'Pool', 'Parking', 'Airport shuttle', 'Fitness center'];

function buildSearchFromParams(params) {
  return {
    q: params.get('q') || '',
    check_in_date: params.get('check_in_date') || day(7),
    check_out_date: params.get('check_out_date') || day(8),
    adults: params.get('adults') || '2',
    children: params.get('children') || '0',
    children_ages: params.get('children_ages') || '',
    currency: params.get('currency') || 'USD'
  };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getHotelClassNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).match(/([1-5](?:\.\d)?)/);
  return match ? Number(match[1]) : null;
}

function ratingLabel(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return '';
  if (rating >= 4.7) return 'Exceptional';
  if (rating >= 4.4) return 'Excellent';
  if (rating >= 4.0) return 'Very good';
  if (rating >= 3.5) return 'Good';
  return 'Guest rating';
}

function getBestPriceSource(property = {}) {
  const sources = Array.isArray(property.priceSources) ? property.priceSources : [];
  if (!sources.length) return null;
  return [...sources].sort((a, b) => {
    const aPrice = a?.totalRate?.amount ?? a?.ratePerNight?.amount ?? Number.POSITIVE_INFINITY;
    const bPrice = b?.totalRate?.amount ?? b?.ratePerNight?.amount ?? Number.POSITIVE_INFINITY;
    return aPrice - bPrice;
  })[0] || null;
}

function getNightAmount(property = {}) {
  const source = getBestPriceSource(property);
  return source?.ratePerNight?.amount ?? property?.ratePerNight?.amount ?? null;
}

function hasFreeCancellation(property = {}) {
  return Array.isArray(property.priceSources) && property.priceSources.some((price) => price?.freeCancellation === true);
}

function matchesAmenity(property, filter) {
  const amenities = (property?.amenities || []).map((item) => String(item || '').toLowerCase());
  const aliases = {
    'free wi-fi': ['free wi-fi', 'free wifi', 'wi-fi', 'wifi'],
    breakfast: ['breakfast'],
    pool: ['pool'],
    parking: ['parking'],
    'airport shuttle': ['airport shuttle', 'shuttle'],
    'fitness center': ['fitness center', 'fitness centre', 'gym']
  };
  return (aliases[filter.toLowerCase()] || [filter.toLowerCase()]).some((needle) => amenities.some((item) => item.includes(needle)));
}

function SearchForm({ value, onChange, onSubmit, busy, compact = false }) {
  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue });
  return (
    <form className={`hotel-search-form${compact ? ' hotel-search-form--compact' : ''}`} onSubmit={onSubmit}>
      <div className="hotel-search-grid">
        <label className="hotel-field hotel-field--destination">
          <span>Destination or hotel</span>
          <input required value={value.q} onChange={(e) => update('q', e.target.value)} placeholder="Bali Resorts, Miami Beach, Hilton…" />
        </label>
        <label className="hotel-field">
          <span>Check in</span>
          <input required type="date" min={day(0)} value={value.check_in_date} onChange={(e) => update('check_in_date', e.target.value)} />
        </label>
        <label className="hotel-field">
          <span>Check out</span>
          <input required type="date" min={value.check_in_date || day(0)} value={value.check_out_date} onChange={(e) => update('check_out_date', e.target.value)} />
        </label>
        <label className="hotel-field">
          <span>Adults</span>
          <select value={value.adults} onChange={(e) => update('adults', e.target.value)}>{[1,2,3,4,5,6,7,8].map((n)=><option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label className="hotel-field">
          <span>Children</span>
          <select value={value.children} onChange={(e) => update('children', e.target.value)}>{[0,1,2,3,4,5,6].map((n)=><option key={n} value={n}>{n}</option>)}</select>
        </label>
        {Number(value.children) > 0 && <label className="hotel-field hotel-field--ages"><span>Children ages</span><input value={value.children_ages} onChange={(e) => update('children_ages', e.target.value)} placeholder="5,8" /></label>}
        <label className="hotel-field"><span>Currency</span><select value={value.currency} onChange={(e) => update('currency', e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>AUD</option><option>INR</option></select></label>
      </div>
      <button className="hotel-search-button" disabled={busy}>{busy ? 'Searching…' : compact ? 'Update Search' : 'Search Hotels'}</button>
    </form>
  );
}

function BookingRequestModal({ property, search, onClose, onCreated }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', rooms:'1' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const clientRequestId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `hotel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await hotelApi.requestBooking({
        clientRequestId,
        propertyToken: property.propertyToken,
        propertyName: property.name,
        rooms: Number(form.rooms || 1),
        customer: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
        search
      });
      onCreated(result);
    } catch (err) { setError(err.message || 'Unable to submit hotel request.'); }
    finally { setSaving(false); }
  };
  return <div className="hotel-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="hotel-modal hotel-request-modal" role="dialog" aria-modal="true" aria-label={`Request ${property.name}`}>
      <button type="button" className="hotel-modal-close" onClick={onClose} aria-label="Close">×</button>
      <span className="hotel-eyebrow">Reservation assistance</span>
      <h2>Request {property.name}</h2>
      <p className="hotel-muted">Send this selected stay to our travel workflow. Your request is not marked confirmed until supplier confirmation is received.</p>
      {error && <div className="hotel-alert hotel-alert--error">{error}</div>}
      <form onSubmit={submit} className="hotel-booking-form">
        <div className="hotel-booking-grid">
          <label><span>First name</span><input required value={form.firstName} onChange={(e)=>setForm({...form,firstName:e.target.value})}/></label>
          <label><span>Last name</span><input required value={form.lastName} onChange={(e)=>setForm({...form,lastName:e.target.value})}/></label>
          <label><span>Email</span><input required type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
          <label><span>Phone</span><input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label>
          <label><span>Rooms</span><select value={form.rooms} onChange={(e)=>setForm({...form,rooms:e.target.value})}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>
        </div>
        <button className="hotel-search-button" disabled={saving}>{saving ? 'Creating request…' : 'Request This Stay'}</button>
      </form>
    </div>
  </div>;
}

function StayDetailsModal({ property, search, onClose, onRequest }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    hotelApi.details({ ...search, property_token: property.propertyToken })
      .then((data) => { if (live) setDetails(data || property); })
      .catch((err) => { if (live) setError(err.message || 'Detailed hotel information is temporarily unavailable.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [property.propertyToken, search]);

  const resolved = details || property;
  const source = getBestPriceSource(resolved) || getBestPriceSource(property);
  const rooms = Array.isArray(resolved.rooms) ? resolved.rooms : [];
  const lat = resolved?.coordinates?.latitude;
  const lng = resolved?.coordinates?.longitude;
  const mapUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  return <div className="hotel-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="hotel-modal hotel-stay-modal" role="dialog" aria-modal="true" aria-label={`${property.name} details`}>
      <button type="button" className="hotel-modal-close" onClick={onClose} aria-label="Close">×</button>
      <div className="hotel-stay-modal__hero">
        {resolved.image ? <img src={resolved.image} alt="" /> : <div className="hotel-image-placeholder"><i className="fas fa-hotel"/></div>}
        <div>
          <span className="hotel-class">{resolved.hotelClass || resolved.type || 'Hotel'}</span>
          <h2>{resolved.name}</h2>
          {resolved.overallRating && <p className="hotel-stay-rating"><strong>{Number(resolved.overallRating).toFixed(1)}</strong> {ratingLabel(resolved.overallRating)} {resolved.reviews ? `· ${Number(resolved.reviews).toLocaleString()} reviews` : ''}</p>}
          {resolved.address && <p className="hotel-stay-address"><i className="fas fa-map-marker-alt"/> {resolved.address}</p>}
          {mapUrl && <a className="hotel-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer"><i className="fas fa-map"/> View on map</a>}
        </div>
      </div>

      {loading && <div className="hotel-loading"><i className="fas fa-circle-notch fa-spin"/> Loading room and property details…</div>}
      {error && <div className="hotel-alert hotel-alert--error">{error} You can still request this property.</div>}

      {!loading && <>
        <div className="hotel-stay-facts">
          {resolved.checkInTime && <span><i className="fas fa-sign-in-alt"/> Check-in {resolved.checkInTime}</span>}
          {resolved.checkOutTime && <span><i className="fas fa-sign-out-alt"/> Check-out {resolved.checkOutTime}</span>}
          {resolved.locationRating && <span><i className="fas fa-location-arrow"/> Location {Number(resolved.locationRating).toFixed(1)}</span>}
          {resolved.ecoCertified && <span><i className="fas fa-leaf"/> Eco certified</span>}
        </div>

        {resolved.description && <p className="hotel-stay-description">{resolved.description}</p>}

        {resolved.amenities?.length > 0 && <div className="hotel-amenities hotel-stay-amenities">{resolved.amenities.slice(0,10).map((item)=><span key={item}>{item}</span>)}</div>}

        <section className="hotel-stay-rate-panel">
          <div>
            <span className="hotel-rate-kicker">Current displayed rate</span>
            <strong>{source?.ratePerNight?.lowest || resolved.ratePerNight?.lowest || 'See available rates'}</strong>
            <small>{source?.totalRate?.lowest ? `${source.totalRate.lowest} total for this stay` : 'Rate details vary by room and provider'}</small>
          </div>
          <div className="hotel-rate-benefits">
            {source?.freeCancellation && <span><i className="fas fa-check-circle"/> Free cancellation{source.freeCancellationUntilDate ? ` until ${source.freeCancellationUntilDate}` : ''}</span>}
            {source?.breakfastIncluded && <span><i className="fas fa-coffee"/> Breakfast included</span>}
            {source?.source && <span><i className="fas fa-building"/> Rate from {source.source}</span>}
          </div>
        </section>

        {rooms.length > 0 && <section className="hotel-room-options">
          <div className="hotel-section-heading"><h3>Room options</h3><span>{rooms.length} option{rooms.length === 1 ? '' : 's'} returned</span></div>
          {rooms.slice(0,5).map((room, index) => {
            const roomSource = Array.isArray(room.rates) ? getBestPriceSource({ priceSources: room.rates }) : null;
            return <div className="hotel-room-row" key={`${room.name || 'room'}-${index}`}>
              <div><strong>{room.name || 'Room option'}</strong>{room.numGuests && <small>Up to {room.numGuests} guests</small>}</div>
              <div><strong>{roomSource?.ratePerNight?.lowest || room.ratePerNight?.lowest || 'Rate on request'}</strong><small>{roomSource?.totalRate?.lowest || room.totalRate?.lowest || ''}</small></div>
            </div>;
          })}
        </section>}
      </>}

      <div className="hotel-stay-modal__actions">
        <button type="button" className="hotel-secondary-button" onClick={onClose}>Back to results</button>
        <button type="button" className="hotel-request-button" onClick={() => onRequest(resolved)}>Request This Stay</button>
      </div>
    </div>
  </div>;
}

function HotelCard({ property, onView }) {
  const source = getBestPriceSource(property);
  const nightly = source?.ratePerNight || property.ratePerNight;
  const total = source?.totalRate || property.totalRate;
  const lat = property?.coordinates?.latitude;
  const lng = property?.coordinates?.longitude;
  const mapUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  return <article className="hotel-result-card">
    <div className="hotel-result-image">
      {property.image ? <img src={property.image} alt="" loading="lazy"/> : <div className="hotel-image-placeholder"><i className="fas fa-hotel"/></div>}
      {property.sponsored && <span className="hotel-sponsored-badge">Sponsored</span>}
    </div>
    <div className="hotel-result-content">
      <div className="hotel-result-heading">
        <div>
          <div className="hotel-class">{property.hotelClass || property.type || 'Hotel'}</div>
          <h2>{property.name}</h2>
          <div className="hotel-location-line">
            {property.locationRating && <span><i className="fas fa-location-arrow"/> Location {Number(property.locationRating).toFixed(1)}</span>}
            {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer"><i className="fas fa-map-marker-alt"/> View on map</a>}
          </div>
        </div>
        {property.overallRating && <div className="hotel-rating"><strong>{Number(property.overallRating).toFixed(1)}</strong><b>{ratingLabel(property.overallRating)}</b><span>{property.reviews ? `${Number(property.reviews).toLocaleString()} reviews` : 'Guest rating'}</span></div>}
      </div>

      {property.description && <p className="hotel-description">{property.description}</p>}
      {property.amenities?.length > 0 && <div className="hotel-amenities">{property.amenities.slice(0,6).map((item)=><span key={item}>{item}</span>)}</div>}

      <div className="hotel-result-footer">
        <div className="hotel-policy-summary">
          {source?.freeCancellation && <span className="hotel-positive"><i className="fas fa-check-circle"/> Free cancellation{source.freeCancellationUntilDate ? ` until ${source.freeCancellationUntilDate}` : ''}</span>}
          {source?.breakfastIncluded && <span className="hotel-positive"><i className="fas fa-coffee"/> Breakfast included</span>}
          {source?.source && <span><i className="fas fa-building"/> {source.source}</span>}
        </div>
        <div className="hotel-price-action">
          <div className="hotel-price">
            <span>{nightly?.lowest ? 'From' : 'Pricing'}</span>
            <strong>{nightly?.lowest || 'See rates'}</strong>
            <small>{nightly?.lowest ? 'per night' : 'Select stay for details'}</small>
            {total?.lowest && <b>{total.lowest} total for stay</b>}
            {nightly?.beforeTaxesFees && <em>{nightly.beforeTaxesFees} before taxes &amp; fees</em>}
          </div>
          <button className="hotel-request-button" onClick={()=>onView(property)} disabled={!property.propertyToken}>View Stay</button>
        </div>
      </div>
    </div>
  </article>;
}

function HotelFilters({ filters, setFilters, onReset, onClose }) {
  const toggleAmenity = (amenity) => {
    const current = filters.amenities || [];
    setFilters({ ...filters, amenities: current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity] });
  };

  return <>
    <div className="hotel-filter-header">
      <div><i className="fas fa-sliders-h"/><h3>Filter stays</h3></div>
      <button type="button" className="hotel-filter-close" onClick={onClose} aria-label="Close filters">×</button>
      <button type="button" className="hotel-filter-reset" onClick={onReset}>Reset</button>
    </div>

    <div className="hotel-filter-group">
      <h4>Price per night</h4>
      <select value={filters.priceBand} onChange={(e)=>setFilters({...filters,priceBand:e.target.value})}>
        <option value="any">Any price</option>
        <option value="under100">Under $100</option>
        <option value="100to200">$100–$200</option>
        <option value="200to300">$200–$300</option>
        <option value="300plus">$300+</option>
      </select>
    </div>

    <div className="hotel-filter-group">
      <h4>Guest rating</h4>
      {[[0,'Any rating'],[3.5,'3.5+ Good'],[4,'4.0+ Very good'],[4.5,'4.5+ Excellent']].map(([value,label])=><label key={value}><input type="radio" name="hotel-rating-filter" checked={Number(filters.rating)===value} onChange={()=>setFilters({...filters,rating:value})}/><span>{label}</span></label>)}
    </div>

    <div className="hotel-filter-group">
      <h4>Hotel class</h4>
      {[5,4,3].map((hotelClass)=><label key={hotelClass}><input type="checkbox" checked={filters.classes.includes(hotelClass)} onChange={()=>setFilters({...filters,classes:filters.classes.includes(hotelClass)?filters.classes.filter((item)=>item!==hotelClass):[...filters.classes,hotelClass]})}/><span>{hotelClass}-star</span></label>)}
    </div>

    <div className="hotel-filter-group">
      <h4>Popular amenities</h4>
      {AMENITY_FILTERS.map((amenity)=><label key={amenity}><input type="checkbox" checked={filters.amenities.includes(amenity)} onChange={()=>toggleAmenity(amenity)}/><span>{amenity}</span></label>)}
    </div>

    <div className="hotel-filter-group">
      <h4>Booking flexibility</h4>
      <label><input type="checkbox" checked={filters.freeCancellation} onChange={(e)=>setFilters({...filters,freeCancellation:e.target.checked})}/><span>Free cancellation</span></label>
    </div>
  </>;
}

const EMPTY_FILTERS = { priceBand: 'any', rating: 0, classes: [], amenities: [], freeCancellation: false };

export default function HotelSearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => buildSearchFromParams(params));
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [detailsProperty, setDetailsProperty] = useState(null);
  const [requestProperty, setRequestProperty] = useState(null);
  const [created, setCreated] = useState(null);
  const [showModifySearch, setShowModifySearch] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortBy, setSortBy] = useState('recommended');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const searchFromUrl = useMemo(() => buildSearchFromParams(params), [params]);
  const hasSearch = Boolean(params.get('q') && params.get('check_in_date') && params.get('check_out_date'));
  const resultsMode = location.pathname === '/hotels/results' && hasSearch;

  useEffect(() => { setForm(searchFromUrl); }, [searchFromUrl]);

  useEffect(() => {
    if (!hasSearch) { setResults([]); setTotalResults(null); return; }
    let live = true;
    setLoading(true); setError(''); setCreated(null);
    hotelApi.search(searchFromUrl).then((data) => {
      if (!live) return;
      setResults(data?.properties || []);
      setTotalResults(Number.isFinite(Number(data?.totalResults)) ? Number(data.totalResults) : null);
      setNextPageToken(data?.nextPageToken || null);
    }).catch((err) => { if (live) setError(err.message || 'Hotel search failed.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [hasSearch, location.search]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (form.check_out_date <= form.check_in_date) { setError('Check-out date must be after check-in date.'); return; }
    const next = new URLSearchParams();
    Object.entries(form).forEach(([key,value])=>{if(value!=='' && value!==null && value!==undefined)next.set(key,String(value));});
    setShowModifySearch(false);
    setFilters(EMPTY_FILTERS);
    setSortBy('recommended');
    navigate(`/hotels/results?${next.toString()}`);
  };

  const loadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const data = await hotelApi.search({ ...searchFromUrl, next_page_token: nextPageToken });
      setResults((prev)=>[...prev,...(data?.properties||[])]);
      setNextPageToken(data?.nextPageToken || null);
      if (Number.isFinite(Number(data?.totalResults))) setTotalResults(Number(data.totalResults));
    } catch (err) { setError(err.message || 'Unable to load more hotels.'); }
    finally { setLoadingMore(false); }
  };

  const filteredResults = useMemo(() => {
    const filtered = results.filter((property) => {
      const nightly = getNightAmount(property);
      if (filters.priceBand !== 'any' && Number.isFinite(nightly)) {
        if (filters.priceBand === 'under100' && nightly >= 100) return false;
        if (filters.priceBand === '100to200' && (nightly < 100 || nightly > 200)) return false;
        if (filters.priceBand === '200to300' && (nightly < 200 || nightly > 300)) return false;
        if (filters.priceBand === '300plus' && nightly < 300) return false;
      } else if (filters.priceBand !== 'any' && !Number.isFinite(nightly)) return false;

      if (Number(filters.rating) > 0 && Number(property.overallRating || 0) < Number(filters.rating)) return false;

      if (filters.classes.length > 0) {
        const classNumber = getHotelClassNumber(property.hotelClass);
        if (!classNumber || !filters.classes.includes(Math.round(classNumber))) return false;
      }

      if (filters.freeCancellation && !hasFreeCancellation(property)) return false;
      if (filters.amenities.length > 0 && !filters.amenities.every((amenity) => matchesAmenity(property, amenity))) return false;
      return true;
    });

    if (sortBy === 'recommended') return filtered;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price') return (getNightAmount(a) ?? Number.POSITIVE_INFINITY) - (getNightAmount(b) ?? Number.POSITIVE_INFINITY);
      if (sortBy === 'rating') return Number(b.overallRating || 0) - Number(a.overallRating || 0);
      if (sortBy === 'reviews') return Number(b.reviews || 0) - Number(a.reviews || 0);
      return 0;
    });
  }, [results, filters, sortBy]);

  const activeFilterCount = (filters.priceBand !== 'any' ? 1 : 0) + (filters.rating ? 1 : 0) + filters.classes.length + filters.amenities.length + (filters.freeCancellation ? 1 : 0);
  const resetFilters = () => setFilters(EMPTY_FILTERS);
  const onCreated = (record) => { setRequestProperty(null); setCreated(record); };
  const guestLabel = `${searchFromUrl.adults} adult${Number(searchFromUrl.adults)!==1?'s':''}${Number(searchFromUrl.children)>0?` · ${searchFromUrl.children} child${Number(searchFromUrl.children)!==1?'ren':''}`:''}`;

  return <div className={`hotel-page${resultsMode ? ' hotel-page--results' : ''}`}>
    <Helmet>
      <title>{resultsMode ? `Hotels in ${searchFromUrl.q} | The Final Seat` : 'Hotel Search & Booking Assistance | The Final Seat'}</title>
      <meta name="description" content="Search hotels and resorts by destination and dates, then submit a trackable hotel booking request to The Final Seat travel team."/>
      <link rel="canonical" href={resultsMode ? 'https://www.thefinalseat.com/hotels/results' : 'https://www.thefinalseat.com/hotels'}/>
    </Helmet>

    {!resultsMode && <>
      <HeroSlider slides={hotelHeroSlides} variant="flights" serviceNavActive="hotels" offerTag={heroOffer}/>
      <section className="hotel-search-section">
        <div className="container">
          <ProductSearchCard
            theme="hotels"
            eyebrow="Find a stay"
            title="Search Hotels"
            trustIcon="fas fa-hotel"
            trustText="Live hotel search. Trackable reservation requests."
          >
            <SearchForm value={form} onChange={setForm} onSubmit={submitSearch} busy={loading}/>
          </ProductSearchCard>
        </div>
      </section>
    </>}

    {resultsMode && <>
      <section className="hotel-results-summary-bar">
        <div className="container hotel-results-summary-inner">
          <div className="hotel-results-summary-copy">
            <span className="hotel-eyebrow">Hotel search</span>
            <h1>{searchFromUrl.q}</h1>
            <p>{formatDate(searchFromUrl.check_in_date)} – {formatDate(searchFromUrl.check_out_date)} · {guestLabel} · {searchFromUrl.currency}</p>
          </div>
          <button type="button" className="hotel-modify-search-button" onClick={()=>setShowModifySearch((open)=>!open)}><i className="fas fa-edit"/> {showModifySearch?'Close Search':'Modify Search'}</button>
        </div>
      </section>

      {showModifySearch && <section className="hotel-modify-search-drawer"><div className="container"><SearchForm value={form} onChange={setForm} onSubmit={submitSearch} busy={loading} compact/></div></section>}

      <section className="hotel-results-section">
        <div className="container">
          {created && <div className="hotel-alert hotel-alert--success"><strong>Request received.</strong> Hotel reference <b>{created.hotelCode}</b> · CRM lead <b>{created.leadCode}</b>. Our team can now track this request end-to-end.</div>}
          {error && <div className="hotel-alert hotel-alert--error">{error}</div>}

          <div className="hotel-results-workspace">
            <aside className={`hotel-filter-sidebar${showMobileFilters?' hotel-filter-sidebar--open':''}`}>
              <HotelFilters filters={filters} setFilters={setFilters} onReset={resetFilters} onClose={()=>setShowMobileFilters(false)}/>
            </aside>
            {showMobileFilters && <button className="hotel-filter-backdrop" type="button" aria-label="Close filters" onClick={()=>setShowMobileFilters(false)}/>} 

            <main className="hotel-results-main">
              <div className="hotel-results-header">
                <div>
                  <span className="hotel-eyebrow">Search results</span>
                  <h2>Hotels in {searchFromUrl.q}</h2>
                  <p>{loading ? 'Searching live hotel options…' : `${filteredResults.length} of ${results.length} loaded option${results.length===1?'':'s'} match your current view${totalResults && totalResults > results.length ? ` · ${totalResults.toLocaleString()} provider results reported` : ''}`}</p>
                </div>
                <div className="hotel-results-actions">
                  <button type="button" className="hotel-mobile-filter-button" onClick={()=>setShowMobileFilters(true)}><i className="fas fa-sliders-h"/> Filters{activeFilterCount?` (${activeFilterCount})`:''}</button>
                  <label className="hotel-sort-control"><span>Sort by</span><select value={sortBy} onChange={(e)=>setSortBy(e.target.value)}><option value="recommended">Recommended</option><option value="price">Price: low to high</option><option value="rating">Guest rating</option><option value="reviews">Most reviewed</option></select></label>
                </div>
              </div>

              {activeFilterCount > 0 && <div className="hotel-active-filter-row"><span>{activeFilterCount} filter{activeFilterCount===1?'':'s'} active</span><button type="button" onClick={resetFilters}>Clear filters</button></div>}

              {loading && <div className="hotel-loading"><i className="fas fa-circle-notch fa-spin"/> Searching live hotel options…</div>}
              {!loading && filteredResults.length===0 && !error && <div className="hotel-empty"><i className="fas fa-search"/><div><strong>No loaded hotels match these filters.</strong><span>Clear filters, load more properties, or modify the destination and dates.</span></div><button type="button" onClick={resetFilters}>Clear filters</button></div>}

              <div className="hotel-results-list">{!loading && filteredResults.map((property,index)=><HotelCard key={`${property.propertyToken||property.name}-${index}`} property={property} onView={setDetailsProperty}/>)}</div>
              {nextPageToken && <div className="hotel-load-more-wrap"><button className="hotel-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Loading…':'Load More Hotels'}</button></div>}
            </main>
          </div>
        </div>
      </section>
    </>}

    {!resultsMode && <SeamlessAdvisorySection variant="flight"/>}
    {detailsProperty && <StayDetailsModal property={detailsProperty} search={searchFromUrl} onClose={()=>setDetailsProperty(null)} onRequest={(property)=>{setDetailsProperty(null);setRequestProperty(property);}}/>}
    {requestProperty && <BookingRequestModal property={requestProperty} search={searchFromUrl} onClose={()=>setRequestProperty(null)} onCreated={onCreated}/>} 
  </div>;
}
