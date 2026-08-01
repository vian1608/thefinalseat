import React from 'react';
import './ModifySearchSummaryBar.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return String(dateStr || '');
  }
}

function ModifySearchSummaryBar({ searchParams = {}, onOpenModifyModal, className = '' }) {
  const fromCode = typeof searchParams.origin === 'object' ? searchParams.origin.code : (searchParams.from || 'JFK');
  const toCode = typeof searchParams.destination === 'object' ? searchParams.destination.code : (searchParams.to || 'LHR');
  const depDate = searchParams.departureDate || searchParams.departure || '';
  const retDate = searchParams.returnDate || searchParams.return || '';

  const adults = parseInt(searchParams.adults || 1, 10);
  const children = parseInt(searchParams.children || 0, 10);
  const infants = parseInt(searchParams.infants || 0, 10);
  const totalPax = adults + children + infants;

  const cabin = searchParams.cabinClass || searchParams.cabin || 'Economy';

  const dateText = retDate ? `${formatDate(depDate)} – ${formatDate(retDate)}` : formatDate(depDate);

  return (
    <div className={`modify-search-summary-bar ${className}`}>
      <div className="summary-info-chips">
        <div className="chip chip--route">
          <i className="fas fa-plane-departure"></i>
          <strong>{fromCode}</strong> &rarr; <strong>{toCode}</strong>
        </div>

        {dateText && (
          <div className="chip chip--dates">
            <i className="fas fa-calendar-alt"></i> {dateText}
          </div>
        )}

        <div className="chip chip--pax">
          <i className="fas fa-user"></i> {totalPax} {totalPax === 1 ? 'Passenger' : 'Passengers'}
        </div>

        <div className="chip chip--cabin">
          <i className="fas fa-chair"></i> {cabin}
        </div>
      </div>

      <button
        type="button"
        className="btn-modify-search-trigger"
        onClick={onOpenModifyModal}
      >
        <i className="fas fa-edit"></i> Modify Search
      </button>
    </div>
  );
}

export default ModifySearchSummaryBar;
