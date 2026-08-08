import React, { useMemo, useState } from 'react';
import { adminAPI } from '../../../shared/api/api';

const withTimeout = (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const normalizeSegment = (segment = {}, index = 0) => {
  const rawDirection = String(segment.journey_direction || segment.direction || segment.leg || 'outbound').toLowerCase();
  const direction = rawDirection === 'return' || rawDirection === 'inbound' ? 'return' : 'outbound';
  return {
    ...segment,
    _key: segment.id || `gds-${Date.now()}-${index}`,
    journey_direction: direction,
    direction,
    carrier_name: segment.carrier_name || segment.airline_name || segment.marketingAirlineName || segment.airlineName || '',
    carrier_code: String(segment.carrier_code || segment.marketing_carrier_code || segment.marketingAirlineCode || segment.airlineCode || '').toUpperCase(),
    flight_number: String(segment.flight_number || segment.flightNumber || ''),
    origin_airport: String(segment.origin_airport || segment.originCode || segment.departureAirport || segment.departure_airport || '').toUpperCase(),
    destination_airport: String(segment.destination_airport || segment.destinationCode || segment.arrivalAirport || segment.arrival_airport || '').toUpperCase(),
    departure_date: segment.departure_date || segment.departureDate || '',
    departure_time: segment.departure_time || segment.departureTime || '',
    arrival_date: segment.arrival_date || segment.arrivalDate || segment.departure_date || segment.departureDate || '',
    arrival_time: segment.arrival_time || segment.arrivalTime || '',
    cabin: segment.cabin || segment.cabinClass || segment.cabin_class || 'Economy'
  };
};

function collectSegments(response) {
  const direct = response?.segments;
  if (Array.isArray(direct)) return direct;

  const nested = response?.data?.segments;
  if (Array.isArray(nested)) return nested;

  const journeys = response?.data?.journeys || response?.journeys;
  if (Array.isArray(journeys)) {
    return journeys.flatMap((journey, journeyIndex) => {
      const direction = String(journey?.journeyType || (journeyIndex === 0 ? 'outbound' : 'return')).toLowerCase();
      return (journey?.segments || []).map(segment => ({
        ...segment,
        journey_direction: direction === 'return' ? 'return' : 'outbound'
      }));
    });
  }

  return [];
}

export default function AdminGdsImportModalV2({ isOpen, onClose, onApply }) {
  const [rawText, setRawText] = useState('');
  const [segments, setSegments] = useState([]);
  const [tripType, setTripType] = useState('auto');
  const [warnings, setWarnings] = useState([]);
  const [parseError, setParseError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(false);

  const detectedTripType = useMemo(() => {
    const hasReturn = segments.some(segment => segment.journey_direction === 'return');
    return hasReturn ? 'round_trip' : 'one_way';
  }, [segments]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (saving) return;
    setRawText('');
    setSegments([]);
    setWarnings([]);
    setParseError('');
    setSaveError('');
    setParsed(false);
    setTripType('auto');
    onClose();
  };

  const parse = async () => {
    setParseError('');
    setSaveError('');

    if (!rawText.trim()) {
      setParseError('Paste the GDS lines or structured itinerary JSON first.');
      return;
    }

    setParsing(true);
    try {
      const response = await withTimeout(
        adminAPI.parseItineraryText(rawText.trim()),
        15000,
        'Itinerary parser'
      );

      if (response?.success === false) {
        const message = response?.error?.message || response?.errors?.join(' ') || 'The itinerary could not be parsed.';
        throw new Error(message);
      }

      const normalized = collectSegments(response).map(normalizeSegment);
      if (normalized.length === 0) {
        throw new Error('No valid flight segments were found. Check the GDS format and try again.');
      }

      setSegments(normalized);
      setWarnings(response?.warnings || response?.data?.warnings || []);
      const responseTrip = String(response?.data?.tripType || response?.tripType || '').toLowerCase();
      if (responseTrip.includes('round')) setTripType('round_trip');
      else if (responseTrip.includes('multi')) setTripType('multi_city');
      else if (responseTrip.includes('one')) setTripType('one_way');
      else setTripType('auto');
      setParsed(true);
    } catch (error) {
      setParseError(error.message || 'Unable to parse itinerary.');
      setParsed(false);
      setSegments([]);
    } finally {
      setParsing(false);
    }
  };

  const updateSegment = (index, field, value) => {
    setSegments(current => current.map((segment, idx) => (
      idx === index ? { ...segment, [field]: value } : segment
    )));
    setSaveError('');
  };

  const removeSegment = index => {
    setSegments(current => current.filter((_, idx) => idx !== index));
  };

  const apply = async () => {
    if (segments.length === 0) {
      setSaveError('There are no flight segments to apply.');
      return;
    }

    const invalid = segments.find(segment =>
      !/^[A-Z]{3}$/.test(segment.origin_airport || '') ||
      !/^[A-Z]{3}$/.test(segment.destination_airport || '')
    );
    if (invalid) {
      setSaveError('Every segment must have valid 3-letter origin and destination airport codes.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const finalSegments = segments.map((segment, index) => ({
        ...segment,
        journey_direction: segment.journey_direction === 'return' ? 'return' : 'outbound',
        direction: segment.journey_direction === 'return' ? 'return' : 'outbound',
        segment_sequence: segments
          .slice(0, index + 1)
          .filter(item => item.journey_direction === segment.journey_direction)
          .length
      }));

      await withTimeout(
        Promise.resolve(onApply({
          segments: finalSegments,
          tripType: tripType === 'auto' ? detectedTripType : tripType,
          sourceText: rawText
        })),
        20000,
        'Apply itinerary'
      );

      resetAndClose();
    } catch (error) {
      setSaveError(error.message || 'The itinerary could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adv2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Import itinerary">
      <div className="adv2-modal adv2-modal--wide">
        <div className="adv2-modal__header">
          <div>
            <h2>Import Itinerary</h2>
            <p>Paste the GDS command/lines once. The system parses the flights and you only correct a direction if the source text was ambiguous.</p>
          </div>
          <button type="button" className="adv2-icon-button" onClick={resetAndClose} disabled={saving}>✕</button>
        </div>

        {!parsed ? (
          <div className="adv2-modal__body">
            <label className="adv2-field">
              <span>GDS / structured itinerary input</span>
              <textarea
                rows={10}
                value={rawText}
                onChange={event => setRawText(event.target.value)}
                placeholder={'Example:\n01 DL 106 Y 15SEP JFKLHR 1930 0745 NN1\n02 DL 107 Y 25SEP LHRJFK 1030 1330 NN1\n\nYou may also paste the structured JSON produced by your itinerary formatter.'}
              />
            </label>

            <div className="adv2-note">
              You do not need to choose outbound/inbound before importing. If your source includes OUTBOUND/RETURN sections or structured journey types, they are preserved automatically.
            </div>

            {parseError && <div className="adv2-alert adv2-alert--error">{parseError}</div>}
          </div>
        ) : (
          <div className="adv2-modal__body">
            <div className="adv2-row adv2-row--between">
              <div>
                <strong>{segments.length} segment{segments.length === 1 ? '' : 's'} parsed</strong>
                <div className="adv2-muted">Review the parsed flights before they are written to the booking.</div>
              </div>
              <label className="adv2-inline-field">
                <span>Trip type</span>
                <select value={tripType} onChange={event => setTripType(event.target.value)}>
                  <option value="auto">Auto detect</option>
                  <option value="one_way">One way</option>
                  <option value="round_trip">Round trip</option>
                  <option value="multi_city">Multi-city</option>
                </select>
              </label>
            </div>

            {warnings.length > 0 && (
              <div className="adv2-alert adv2-alert--warning">
                {warnings.map((warning, index) => <div key={index}>• {warning}</div>)}
              </div>
            )}

            <div className="adv2-segment-list">
              {segments.map((segment, index) => (
                <div className="adv2-segment-card" key={segment._key || index}>
                  <div className="adv2-segment-card__head">
                    <strong>Flight {index + 1}</strong>
                    <button type="button" className="adv2-link-danger" onClick={() => removeSegment(index)}>Remove</button>
                  </div>
                  <div className="adv2-grid adv2-grid--4">
                    <label className="adv2-field">
                      <span>Direction</span>
                      <select
                        value={segment.journey_direction || 'outbound'}
                        onChange={event => updateSegment(index, 'journey_direction', event.target.value)}
                      >
                        <option value="outbound">Outbound</option>
                        <option value="return">Return</option>
                      </select>
                    </label>
                    <label className="adv2-field">
                      <span>Airline</span>
                      <input value={segment.carrier_name || ''} onChange={event => updateSegment(index, 'carrier_name', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>Carrier</span>
                      <input value={segment.carrier_code || ''} maxLength={3} onChange={event => updateSegment(index, 'carrier_code', event.target.value.toUpperCase())} />
                    </label>
                    <label className="adv2-field">
                      <span>Flight #</span>
                      <input value={segment.flight_number || ''} onChange={event => updateSegment(index, 'flight_number', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>From</span>
                      <input value={segment.origin_airport || ''} maxLength={3} onChange={event => updateSegment(index, 'origin_airport', event.target.value.toUpperCase())} />
                    </label>
                    <label className="adv2-field">
                      <span>To</span>
                      <input value={segment.destination_airport || ''} maxLength={3} onChange={event => updateSegment(index, 'destination_airport', event.target.value.toUpperCase())} />
                    </label>
                    <label className="adv2-field">
                      <span>Departure date</span>
                      <input type="date" value={segment.departure_date || ''} onChange={event => updateSegment(index, 'departure_date', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>Departure time</span>
                      <input type="time" value={segment.departure_time || ''} onChange={event => updateSegment(index, 'departure_time', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>Arrival date</span>
                      <input type="date" value={segment.arrival_date || ''} onChange={event => updateSegment(index, 'arrival_date', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>Arrival time</span>
                      <input type="time" value={segment.arrival_time || ''} onChange={event => updateSegment(index, 'arrival_time', event.target.value)} />
                    </label>
                    <label className="adv2-field">
                      <span>Cabin</span>
                      <select value={segment.cabin || 'Economy'} onChange={event => updateSegment(index, 'cabin', event.target.value)}>
                        <option>Economy</option>
                        <option>Premium Economy</option>
                        <option>Business</option>
                        <option>First</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {saveError && <div className="adv2-alert adv2-alert--error">{saveError}</div>}
          </div>
        )}

        <div className="adv2-modal__footer">
          {parsed && (
            <button type="button" className="adv2-button adv2-button--secondary" onClick={() => { setParsed(false); setSaveError(''); }} disabled={saving}>
              Back to input
            </button>
          )}
          <span className="adv2-spacer" />
          <button type="button" className="adv2-button adv2-button--secondary" onClick={resetAndClose} disabled={saving}>Cancel</button>
          {!parsed ? (
            <button type="button" className="adv2-button adv2-button--primary" onClick={parse} disabled={parsing}>
              {parsing ? 'Parsing…' : 'Parse & Preview'}
            </button>
          ) : (
            <button type="button" className="adv2-button adv2-button--danger" onClick={apply} disabled={saving || segments.length === 0}>
              {saving ? 'Applying itinerary…' : 'Confirm & Apply Itinerary'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
