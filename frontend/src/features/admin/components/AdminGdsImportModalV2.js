import React, { useMemo, useState } from 'react';
import { adminAPI } from '../../../shared/api/api';
import {
  GOOGLE_FLIGHTS_IMPORT_PROMPT,
  currentTravelYear,
  normalizeGdsBlockForParser
} from '../utils/gdsImportNormalizer';

const withTimeout = (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
};

const normalizeSegment = (segment = {}, index = 0) => {
  const rawDirection = String(segment.journey_direction || segment.direction || segment.leg || 'outbound').toLowerCase();
  const direction = rawDirection === 'return' || rawDirection === 'inbound' ? 'return' : 'outbound';
  return {
    ...segment,
    _key: segment.id || segment._key || `gds-${Date.now()}-${index}`,
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

const tripTypeLabel = value => ({
  one_way: 'One Way',
  round_trip: 'Round Trip',
  multi_city: 'Multi-City'
}[value] || 'One Way');

const newLeg = (index = 0) => ({
  id: `multi-${Date.now()}-${index}`,
  text: '',
  year: currentTravelYear()
});

function YearSelect({ value, onChange }) {
  const thisYear = currentTravelYear();
  const years = Array.from({ length: 7 }, (_, index) => thisYear - 1 + index);
  return (
    <select value={value} onChange={event => onChange(Number(event.target.value))}>
      {years.map(year => <option key={year} value={year}>{year}</option>)}
    </select>
  );
}

function GdsInputBlock({ title, helper, text, year, onTextChange, onYearChange, onRemove, removable = false }) {
  return (
    <div className="adv2-card" style={{ marginTop: 14 }}>
      <div className="adv2-row adv2-row--between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <div>
          <strong>{title}</strong>
          {helper && <div className="adv2-muted" style={{ marginTop: 3 }}>{helper}</div>}
        </div>
        <div className="adv2-row" style={{ gap: 8, alignItems: 'center' }}>
          <label className="adv2-inline-field">
            <span>Year</span>
            <YearSelect value={year} onChange={onYearChange} />
          </label>
          {removable && (
            <button type="button" className="adv2-link-danger" onClick={onRemove}>Remove</button>
          )}
        </div>
      </div>
      <textarea
        rows={6}
        value={text}
        onChange={event => onTextChange(event.target.value)}
        placeholder={'Paste GDS lines, for example:\n01 UA 2204 Y 12AUG EWRIAH 1200 1451 NN1\n02 UA 1675 Y 12AUG IAHMDE 1625 2110 NN1'}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
      <div className="adv2-muted" style={{ marginTop: 7 }}>
        Both <strong>01 UA 2204 Y 12AUG EWRIAH...</strong> and <strong>SS UA 2204 Y 12AUG2026 EWR IAH...</strong> are accepted. The selected year is added automatically when the line only contains DDMMM.
      </div>
    </div>
  );
}

export default function AdminGdsImportModalV2({ isOpen, onClose, onApply }) {
  const defaultYear = currentTravelYear();
  const [tripType, setTripType] = useState('one_way');
  const [outbound, setOutbound] = useState({ text: '', year: defaultYear });
  const [returnLeg, setReturnLeg] = useState({ text: '', year: defaultYear });
  const [multiLegs, setMultiLegs] = useState([newLeg(0), newLeg(1)]);
  const [segments, setSegments] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [parseError, setParseError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const multiLegCount = multiLegs.length;

  const sourceText = useMemo(() => {
    if (tripType === 'one_way') return outbound.text;
    if (tripType === 'round_trip') {
      return `OUTBOUND\n${outbound.text}\n\nRETURN\n${returnLeg.text}`;
    }
    return multiLegs.map((leg, index) => `JOURNEY ${index + 1}\n${leg.text}`).join('\n\n');
  }, [tripType, outbound.text, returnLeg.text, multiLegs]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (saving) return;
    setTripType('one_way');
    setOutbound({ text: '', year: defaultYear });
    setReturnLeg({ text: '', year: defaultYear });
    setMultiLegs([newLeg(0), newLeg(1)]);
    setSegments([]);
    setWarnings([]);
    setParseError('');
    setSaveError('');
    setParsed(false);
    setShowPrompt(false);
    setPromptCopied(false);
    onClose();
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_FLIGHTS_IMPORT_PROMPT);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = GOOGLE_FLIGHTS_IMPORT_PROMPT;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2500);
  };

  const updateMultiLeg = (index, patch) => {
    setMultiLegs(current => current.map((leg, idx) => idx === index ? { ...leg, ...patch } : leg));
    setParseError('');
  };

  const addMultiLeg = () => {
    setMultiLegs(current => [...current, newLeg(current.length)]);
    setParseError('');
  };

  const removeMultiLeg = index => {
    setMultiLegs(current => current.length <= 2 ? current : current.filter((_, idx) => idx !== index));
    setParseError('');
  };

  const parseResponse = (response, label) => {
    if (response?.success === false) {
      const message = response?.error?.message || response?.errors?.join(' ') || `${label} could not be parsed.`;
      throw new Error(message);
    }
    const normalized = collectSegments(response).map(normalizeSegment);
    if (normalized.length === 0) {
      throw new Error(`${label}: no valid flight segments were found. Check the GDS format and try again.`);
    }
    return {
      segments: normalized,
      warnings: response?.warnings || response?.data?.warnings || []
    };
  };

  const parse = async () => {
    setParseError('');
    setSaveError('');
    setWarnings([]);

    if (tripType === 'one_way' && !outbound.text.trim()) {
      setParseError('Paste the one-way / outbound GDS lines first.');
      return;
    }
    if (tripType === 'round_trip' && (!outbound.text.trim() || !returnLeg.text.trim())) {
      setParseError('Round Trip requires both Outbound and Return GDS lines.');
      return;
    }
    if (tripType === 'multi_city') {
      if (multiLegs.length < 2) {
        setParseError('Multi-City requires at least two segments/legs.');
        return;
      }
      const emptyIndex = multiLegs.findIndex(leg => !leg.text.trim());
      if (emptyIndex >= 0) {
        setParseError(`Multi-City Segment ${emptyIndex + 1} is empty.`);
        return;
      }
    }

    setParsing(true);
    try {
      if (tripType === 'multi_city') {
        const parsedLegs = await Promise.all(multiLegs.map(async (leg, legIndex) => {
          const normalizedText = normalizeGdsBlockForParser(leg.text, leg.year);
          const response = await withTimeout(
            adminAPI.parseItineraryText(`TRIP: ONE_WAY\nOUTBOUND\n${normalizedText}`),
            15000,
            `Multi-City Segment ${legIndex + 1} parser`
          );
          const result = parseResponse(response, `Multi-City Segment ${legIndex + 1}`);
          return {
            warnings: result.warnings,
            segments: result.segments.map((segment, segmentIndex) => ({
              ...segment,
              journey_direction: 'outbound',
              direction: 'outbound',
              journey_index: legIndex + 1,
              multi_city_leg: legIndex + 1,
              segment_sequence: segmentIndex + 1
            }))
          };
        }));

        setSegments(parsedLegs.flatMap(result => result.segments));
        setWarnings(parsedLegs.flatMap((result, index) => result.warnings.map(warning => `Segment ${index + 1}: ${warning}`)));
        setParsed(true);
        return;
      }

      let normalizedText = `TRIP: ${tripType === 'round_trip' ? 'ROUND_TRIP' : 'ONE_WAY'}\nOUTBOUND\n${normalizeGdsBlockForParser(outbound.text, outbound.year)}`;
      if (tripType === 'round_trip') {
        normalizedText += `\nRETURN\n${normalizeGdsBlockForParser(returnLeg.text, returnLeg.year)}`;
      }

      const response = await withTimeout(
        adminAPI.parseItineraryText(normalizedText),
        15000,
        'Itinerary parser'
      );
      const result = parseResponse(response, 'Itinerary');
      setSegments(result.segments);
      setWarnings(result.warnings);
      setParsed(true);
    } catch (error) {
      setParseError(error?.userMessage || error?.message || 'Unable to parse itinerary.');
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

    const invalidIndex = segments.findIndex(segment =>
      !/^[A-Z]{3}$/.test(segment.origin_airport || '') ||
      !/^[A-Z]{3}$/.test(segment.destination_airport || '') ||
      !segment.flight_number ||
      !segment.departure_date ||
      !segment.departure_time ||
      !segment.arrival_time
    );
    if (invalidIndex >= 0) {
      setSaveError(`Flight ${invalidIndex + 1} is incomplete. Each flight needs carrier/flight, airports, date, departure time and arrival time.`);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const directionCounters = { outbound: 0, return: 0 };
      const finalSegments = segments.map((segment, index) => {
        const direction = tripType === 'multi_city'
          ? 'outbound'
          : (segment.journey_direction === 'return' ? 'return' : 'outbound');
        directionCounters[direction] += 1;
        return {
          ...segment,
          journey_direction: direction,
          direction,
          segment_sequence: tripType === 'multi_city' ? index + 1 : directionCounters[direction],
          ...(tripType === 'multi_city' ? {
            journey_index: Number(segment.journey_index || segment.multi_city_leg || 1),
            multi_city_leg: Number(segment.journey_index || segment.multi_city_leg || 1)
          } : {})
        };
      });

      await withTimeout(
        Promise.resolve(onApply({
          segments: finalSegments,
          tripType,
          sourceText
        })),
        20000,
        'Apply itinerary'
      );

      resetAndClose();
    } catch (error) {
      setSaveError(error?.userMessage || error?.message || 'The itinerary could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const renderTripInputs = () => {
    if (tripType === 'one_way') {
      return (
        <GdsInputBlock
          title="One Way / Outbound GDS Lines"
          helper="Paste all flights in the one-way journey, including connections."
          text={outbound.text}
          year={outbound.year}
          onTextChange={text => setOutbound(current => ({ ...current, text }))}
          onYearChange={year => setOutbound(current => ({ ...current, year }))}
        />
      );
    }

    if (tripType === 'round_trip') {
      return (
        <>
          <GdsInputBlock
            title="Outbound Journey GDS Lines"
            helper="Paste every outbound flight segment in order."
            text={outbound.text}
            year={outbound.year}
            onTextChange={text => setOutbound(current => ({ ...current, text }))}
            onYearChange={year => setOutbound(current => ({ ...current, year }))}
          />
          <GdsInputBlock
            title="Return Journey GDS Lines"
            helper="Paste every return flight segment in order."
            text={returnLeg.text}
            year={returnLeg.year}
            onTextChange={text => setReturnLeg(current => ({ ...current, text }))}
            onYearChange={year => setReturnLeg(current => ({ ...current, year }))}
          />
        </>
      );
    }

    return (
      <>
        {multiLegs.map((leg, index) => (
          <GdsInputBlock
            key={leg.id}
            title={`Multi-City Segment ${index + 1}`}
            helper="Paste the flight(s) for this city-to-city leg. Connections may contain multiple GDS lines."
            text={leg.text}
            year={leg.year}
            onTextChange={text => updateMultiLeg(index, { text })}
            onYearChange={year => updateMultiLeg(index, { year })}
            removable={multiLegs.length > 2}
            onRemove={() => removeMultiLeg(index)}
          />
        ))}
        <button
          type="button"
          className="adv2-button adv2-button--secondary"
          onClick={addMultiLeg}
          style={{ marginTop: 12, width: '100%' }}
        >
          + Add Multi-City Segment
        </button>
      </>
    );
  };

  return (
    <div className="adv2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Import itinerary">
      <div className="adv2-modal adv2-modal--wide">
        <div className="adv2-modal__header">
          <div>
            <h2>Import Itinerary</h2>
            <p>Choose the trip type first. Then paste the GDS lines into the matching journey fields.</p>
          </div>
          <button type="button" className="adv2-icon-button" onClick={resetAndClose} disabled={saving}>✕</button>
        </div>

        {!parsed ? (
          <div className="adv2-modal__body">
            <div className="adv2-row adv2-row--between" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="adv2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['one_way', 'One Way'],
                  ['round_trip', 'Round Trip'],
                  ['multi_city', 'Multi-City']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`adv2-button ${tripType === value ? 'adv2-button--primary' : 'adv2-button--secondary'}`}
                    onClick={() => { setTripType(value); setParseError(''); setSaveError(''); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="adv2-button adv2-button--secondary"
                onClick={() => setShowPrompt(current => !current)}
                aria-expanded={showPrompt}
                title="Google Flights copy/paste prompt"
              >
                ⓘ Google Flights Prompt
              </button>
            </div>

            {showPrompt && (
              <div className="adv2-card" style={{ marginTop: 14 }}>
                <div className="adv2-row adv2-row--between" style={{ alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong>Google Flights → ChatGPT → CRM Prompt</strong>
                    <div className="adv2-muted">Copy this prompt, paste it into ChatGPT, then paste the Google Flights details underneath it.</div>
                  </div>
                  <button type="button" className="adv2-button adv2-button--primary" onClick={copyPrompt}>
                    {promptCopied ? '✓ Prompt Copied' : 'Copy Prompt'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={10}
                  value={GOOGLE_FLIGHTS_IMPORT_PROMPT}
                  style={{ width: '100%', fontFamily: 'monospace' }}
                  onFocus={event => event.target.select()}
                />
              </div>
            )}

            <div className="adv2-note" style={{ marginTop: 14 }}>
              Selected trip: <strong>{tripTypeLabel(tripType)}</strong>. The importer accepts numbered GDS lines such as <strong>01 UA 2204 Y 12AUG EWRIAH 1200 1451 NN1</strong>. If the year is omitted, the Year field is applied automatically.
            </div>

            {renderTripInputs()}

            {parseError && <div className="adv2-alert adv2-alert--error" style={{ marginTop: 14 }}>{parseError}</div>}
          </div>
        ) : (
          <div className="adv2-modal__body">
            <div className="adv2-row adv2-row--between">
              <div>
                <strong>{segments.length} flight segment{segments.length === 1 ? '' : 's'} parsed</strong>
                <div className="adv2-muted">{tripTypeLabel(tripType)} — review every flight before saving it to the booking.</div>
              </div>
              {tripType === 'multi_city' && <span className="adv2-badge adv2-badge--info">{multiLegCount} multi-city segments</span>}
            </div>

            {warnings.length > 0 && (
              <div className="adv2-alert adv2-alert--warning" style={{ marginTop: 12 }}>
                {warnings.map((warning, index) => <div key={`${warning}-${index}`}>• {warning}</div>)}
              </div>
            )}

            <div className="adv2-segment-list">
              {segments.map((segment, index) => (
                <div className="adv2-segment-card" key={segment._key || index}>
                  <div className="adv2-segment-card__head">
                    <strong>
                      Flight {index + 1}
                      {tripType === 'multi_city' ? ` · Multi-City Segment ${segment.journey_index || segment.multi_city_leg || 1}` : ''}
                    </strong>
                    <button type="button" className="adv2-link-danger" onClick={() => removeSegment(index)}>Remove</button>
                  </div>
                  <div className="adv2-grid adv2-grid--4">
                    {tripType === 'round_trip' && (
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
                    )}
                    {tripType === 'multi_city' && (
                      <label className="adv2-field">
                        <span>Multi-City Segment</span>
                        <select
                          value={segment.journey_index || segment.multi_city_leg || 1}
                          onChange={event => {
                            const leg = Number(event.target.value);
                            updateSegment(index, 'journey_index', leg);
                            updateSegment(index, 'multi_city_leg', leg);
                          }}
                        >
                          {multiLegs.map((_, legIndex) => <option key={legIndex + 1} value={legIndex + 1}>Segment {legIndex + 1}</option>)}
                        </select>
                      </label>
                    )}
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
            <button
              type="button"
              className="adv2-button adv2-button--secondary"
              onClick={() => { setParsed(false); setSaveError(''); setSegments([]); }}
              disabled={saving}
            >
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
