import React, { useState } from 'react';
import { carAPI } from '../../../shared/api/api';
import './CarResultCard.css';

function ratingLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return '';
  if (value >= 9) return 'Exceptional';
  if (value >= 8.5) return 'Excellent';
  if (value >= 8) return 'Very Good';
  if (value >= 7) return 'Good';
  return 'Guest rating';
}

function formatMoney(amount, currency = 'USD') {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}

function CarResultCard({ result, enrichment = {} }) {
  const [redirecting, setRedirecting] = useState(false);
  const [dealError, setDealError] = useState('');

  const carId = result.car_id || result.id;
  const supplierId = result.supplier_id || result.supplier;
  const pickupDepotId = result.pickup_depot_id || result.pickupDepotId;

  const carInfo = enrichment.carsById?.[carId] || result.vehicle || {};
  const supplierInfo = enrichment.suppliersById?.[supplierId] || result.supplier || {};
  const depotInfo = enrichment.depotsById?.[pickupDepotId] || result.depot || {};
  const depotScoreInfo = enrichment.depotScoresById?.[pickupDepotId] || {};

  const makeModel = carInfo.make && carInfo.model
    ? `${carInfo.make} ${carInfo.model}`
    : (carInfo.name || result.vehicle_name || 'Rental Car');
  const category = carInfo.category || result.category || null;
  const isOrSimilar = carInfo.or_similar === true || result.or_similar === true;
  const imageUrl = carInfo.image_url || carInfo.imageUrl || result.image_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80';

  const seats = carInfo.seats || result.seats || null;
  const doors = carInfo.doors || result.doors || null;
  const transmission = carInfo.transmission || result.transmission || null;
  const hasAirCon = carInfo.air_conditioning === true || result.air_conditioning === true;
  const largeBags = carInfo.baggage?.large_bags || result.large_bags || null;

  const supplierName = supplierInfo.name || supplierInfo.supplier_name || result.supplier_name || 'Rental supplier';
  const supplierLogo = supplierInfo.logo_url || supplierInfo.logoUrl || result.supplier_logo || '';
  const reviewScore = depotScoreInfo.score ?? supplierInfo.rating ?? result.review_score ?? null;
  const depotName = depotInfo.name || result.depot_name || null;
  const pickupMethod = depotInfo.pickup_method || depotInfo.type || result.pickup_method || null;

  const policies = result.policies || {};
  const cancellation = policies.cancellation || {};
  const freeCancellation = cancellation.free_cancellation === true;
  const cancelDetail = cancellation.cancel_until || null;
  const mileageType = policies.mileage?.type || null;
  const fuelPolicy = policies.fuel?.policy || null;
  const paymentTiming = policies.payment_timing || null;

  const pricing = result.pricing || {};
  const currency = pricing.currency || 'USD';
  const depositAmount = policies.deposit?.amount ?? null;
  const depositText = formatMoney(depositAmount, currency);
  const numericRentalTotal = Number(pricing.rental_total);
  const rentalTotal = Number.isFinite(numericRentalTotal)
    ? formatMoney(numericRentalTotal, currency)
    : (pricing.display_price || null);
  const extraCharges = Array.isArray(pricing.extra_charges) ? pricing.extra_charges : [];
  const webUrl = result.url?.web || result.web_url || result.booking_url || '';

  const getSafeDealUrl = () => {
    if (!webUrl) return null;
    try {
      const parsed = new URL(webUrl);
      return parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
      return null;
    }
  };

  const handleViewDeal = () => {
    setDealError('');
    const safeUrl = getSafeDealUrl();
    if (!safeUrl) {
      setDealError('Deal details are temporarily unavailable for this vehicle. Please choose another option or retry your search.');
      setRedirecting(false);
      return;
    }

    setRedirecting(true);

    void carAPI.recordClick({
      car_id: carId,
      supplier_id: supplierId,
      pickup_depot_id: pickupDepotId,
      currency,
      displayed_total: rentalTotal,
      booking_url: safeUrl
    }).catch(() => {});

    try {
      window.location.assign(safeUrl);
    } catch {
      setRedirecting(false);
      setDealError('We could not open the rental provider. Please try again.');
    }
  };

  const hasSpecs = category || transmission || seats || doors || largeBags || hasAirCon;
  const hasPolicies = freeCancellation || mileageType || fuelPolicy || depositText || paymentTiming;

  return (
    <div className="car-result-card">
      <div className="car-card-main">
        <div className="car-card-media">
          <img src={imageUrl} alt={makeModel} className="car-card-img" loading="lazy" />
          {category && <span className="car-category-badge">{category}</span>}
        </div>

        <div className="car-card-content">
          <div className="car-card-header">
            <div>
              <h3 className="car-title">
                {makeModel} {isOrSimilar && <span className="car-similar-tag">or similar</span>}
              </h3>
              <div className="car-supplier-info">
                {supplierLogo ? (
                  <img src={supplierLogo} alt={supplierName} className="supplier-logo" />
                ) : (
                  <span className="supplier-name-tag">{supplierName}</span>
                )}
                {(depotName || pickupMethod) && <span className="car-depot-location"><i className="fas fa-map-marker-alt" /> {[depotName, pickupMethod].filter(Boolean).join(' · ')}</span>}
              </div>
            </div>

            {reviewScore !== null && reviewScore !== undefined && Number.isFinite(Number(reviewScore)) && (
              <div className="car-rating-box">
                <span className="rating-score">{Number(reviewScore).toFixed(1)}</span>
                <span className="rating-label">{ratingLabel(reviewScore)}</span>
              </div>
            )}
          </div>

          {hasSpecs && <div className="car-specs-grid">
            {category && <span className="car-spec-item" title="Category"><i className="fas fa-car-side" /> {category}</span>}
            {transmission && <span className="car-spec-item" title="Transmission"><i className="fas fa-cog" /> {transmission}</span>}
            {seats && <span className="car-spec-item" title="Passengers"><i className="fas fa-user" /> {seats} Seats</span>}
            {doors && <span className="car-spec-item" title="Doors"><i className="fas fa-door-closed" /> {doors} Doors</span>}
            {largeBags && <span className="car-spec-item" title="Baggage"><i className="fas fa-suitcase" /> {largeBags} Bag{Number(largeBags) === 1 ? '' : 's'}</span>}
            {hasAirCon && <span className="car-spec-item" title="Air Conditioning"><i className="fas fa-snowflake" /> Air conditioning</span>}
          </div>}

          {hasPolicies && <div className="car-policies-list">
            {freeCancellation && <span className="policy-badge policy-badge--green"><i className="fas fa-check-circle" /> Free cancellation{cancelDetail ? ` (${cancelDetail})` : ''}</span>}
            {mileageType && <span className="policy-badge"><i className="fas fa-road" /> {mileageType} mileage</span>}
            {fuelPolicy && <span className="policy-badge"><i className="fas fa-gas-pump" /> Fuel: {fuelPolicy}</span>}
            {depositText && <span className="policy-badge"><i className="fas fa-shield-alt" /> Deposit: {depositText}</span>}
            {paymentTiming && <span className="policy-badge"><i className="fas fa-credit-card" /> {paymentTiming}</span>}
          </div>}
        </div>

        <div className="car-card-pricing">
          <div className="price-breakdown">
            <span className="price-label">Rental total</span>
            {rentalTotal ? (
              <div className="price-amount"><span className="total-num">{rentalTotal}</span></div>
            ) : (
              <div className="price-amount price-amount--unavailable"><span className="total-num">See provider price</span></div>
            )}

            {extraCharges.length > 0 && (
              <div className="extra-charges-notice">
                {extraCharges.map((charge, idx) => {
                  const chargeAmount = formatMoney(charge.amount, currency);
                  return <div key={`${charge.type || 'charge'}-${idx}`} className="extra-charge-line">
                    <span>{charge.type || 'Additional charge'}:</span>
                    <span>{charge.included ? 'Included' : (chargeAmount ? `+${chargeAmount}` : 'See provider')}</span>
                  </div>;
                })}
              </div>
            )}

            <span className="price-guarantee-note">Current provider information. Verify the final price, inclusions, deposit and cancellation terms before completing the rental.</span>
          </div>

          <div className="car-cta-wrapper">
            <p className="redirect-notice-text">You’ll continue securely on Booking.com to review the complete rental terms and finish the reservation.</p>
            {dealError && <p role="alert" style={{ color: '#991b1b', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{dealError}</p>}
            <button
              type="button"
              className={`car-deal-btn ${redirecting ? 'car-deal-btn--loading' : ''}`}
              onClick={handleViewDeal}
              disabled={redirecting || !webUrl}
            >
              <span>{redirecting ? 'Opening Provider...' : 'View Rental'}</span>
              <i className="fas fa-external-link-alt" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="car-card-disclosure">
        <i className="fas fa-info-circle" aria-hidden="true" />
        <span>The Final Seat provides car-rental search assistance. Inventory, prices, policies, and reservations are provided by Booking.com and participating rental suppliers. We may earn a commission from eligible reservations.</span>
      </div>
    </div>
  );
}

export default CarResultCard;
