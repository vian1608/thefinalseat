import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import CarSearchForm from '../components/CarSearchForm';
import CarResultCard from '../components/CarResultCard';
import { carAPI } from '../../../shared/api/api';
import './CarSearchResultsPage.css';

const CATEGORY_OPTIONS = ['Small', 'Medium', 'Large', 'Estate', 'SUV', 'Premium', 'Carrier/Van'];
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual'];
const MILEAGE_OPTIONS = ['Unlimited', 'Limited'];
const DEPOT_TYPES = ['In terminal', 'Car rental centre', 'Outside terminal', 'Shuttle bus', 'Meet and greet'];

function CarSearchResultsPage() {
  const location = useLocation();

  const [searchParams, setSearchParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [requestId, setRequestId] = useState('');

  const [results, setResults] = useState([]);
  const [enrichment, setEnrichment] = useState({});
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showEditSearch, setShowEditSearch] = useState(false);

  // Filter States
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTransmissions, setSelectedTransmissions] = useState([]);
  const [selectedMileages, setSelectedMileages] = useState([]);
  const [selectedDepotTypes, setSelectedDepotTypes] = useState([]);
  const [airConOnly, setAirConOnly] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('price_asc'); // 'price_asc', 'price_desc', 'rating'

  // Parse query parameters and fetch car results
  const fetchCarResults = useCallback(async (paramsObj, isNextPage = false) => {
    if (isNextPage) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setErrorMsg('');
    }

    try {
      const apiPayload = {
        ...paramsObj,
        filters: {
          ...(selectedCategories.length > 0 && { vehicle_category: selectedCategories }),
          ...(selectedTransmissions.length > 0 && { transmission: selectedTransmissions }),
          ...(selectedMileages.length > 0 && { mileage: selectedMileages }),
          ...(selectedDepotTypes.length > 0 && { depot_type: selectedDepotTypes }),
          ...(airConOnly && { air_conditioning: true })
        },
        sort: {
          by: sortBy === 'rating' ? 'review_score' : 'price',
          direction: sortBy === 'price_desc' ? 'descending' : 'ascending'
        },
        ...(isNextPage && nextPageToken && { next_page: nextPageToken })
      };

      const response = await carAPI.search(apiPayload);
      const data = response?.data || response || {};

      const fetchedResults = data.results || [];
      const fetchedEnrichment = data.enrichment || {};

      if (isNextPage) {
        setResults(prev => [...prev, ...fetchedResults]);
      } else {
        setResults(fetchedResults);
      }

      setEnrichment(prev => ({
        carsById: { ...(prev.carsById || {}), ...(fetchedEnrichment.carsById || {}) },
        suppliersById: { ...(prev.suppliersById || {}), ...(fetchedEnrichment.suppliersById || {}) },
        depotsById: { ...(prev.depotsById || {}), ...(fetchedEnrichment.depotsById || {}) },
        depotScoresById: { ...(prev.depotScoresById || {}), ...(fetchedEnrichment.depotScoresById || {}) }
      }));

      setNextPageToken(data.metadata?.next_page || null);
    } catch (err) {
      console.error('Car search error:', err);
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Car-rental search is temporarily unavailable. Please try again shortly.');
      setRequestId(err.response?.data?.error?.requestId || '');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategories, selectedTransmissions, selectedMileages, selectedDepotTypes, airConOnly, sortBy, nextPageToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const saved = sessionStorage.getItem('carSearchParams');

    let parsed = saved ? JSON.parse(saved) : null;
    if (!parsed && urlParams.get('pickup')) {
      const pickupVal = urlParams.get('pickup');
      const dropoffVal = urlParams.get('dropoff') || pickupVal;
      parsed = {
        pickupLocation: { airport: pickupVal },
        dropoffLocation: { airport: dropoffVal },
        pickupText: pickupVal,
        dropoffText: dropoffVal,
        pickupDate: urlParams.get('pickupDate') || '2026-09-10',
        pickupTime: urlParams.get('pickupTime') || '10:00:00',
        dropoffDate: urlParams.get('dropoffDate') || '2026-09-15',
        dropoffTime: urlParams.get('dropoffTime') || '10:00:00',
        driverAge: parseInt(urlParams.get('driverAge') || '30', 10),
        currency: urlParams.get('currency') || 'USD'
      };
    }

    if (parsed) {
      setSearchParams(parsed);
      fetchCarResults(parsed);
    } else {
      setLoading(false);
    }
  }, [location.search, fetchCarResults]);

  const handleCategoryToggle = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleTransmissionToggle = (tr) => {
    setSelectedTransmissions(prev =>
      prev.includes(tr) ? prev.filter(t => t !== tr) : [...prev, tr]
    );
  };

  const handleMileageToggle = (m) => {
    setSelectedMileages(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const handleDepotTypeToggle = (dt) => {
    setSelectedDepotTypes(prev =>
      prev.includes(dt) ? prev.filter(d => d !== dt) : [...prev, dt]
    );
  };

  const handleResetFilters = () => {
    setSelectedCategories([]);
    setSelectedTransmissions([]);
    setSelectedMileages([]);
    setSelectedDepotTypes([]);
    setAirConOnly(false);
    setSortBy('price_asc');
  };

  return (
    <div className="car-results-page">
      <Helmet>
        <title>Car Rental Search Results | The Final Seat</title>
        <meta name="description" content="Compare car rental options, suppliers, pickup locations, and policies through The Final Seat." />
      </Helmet>

      {/* Header Summary Bar */}
      <section className="car-results-summary-bar">
        <div className="container car-summary-inner">
          <div className="car-summary-info">
            <div className="summary-title-line">
              <i className="fas fa-car" aria-hidden="true" />
              <h2>
                Car Rentals in {searchParams?.pickupText || 'Airport Location'}
              </h2>
            </div>
            <p className="summary-dates-sub">
              {searchParams?.pickupDate} ({searchParams?.pickupTime?.substring(0, 5)}) — {searchParams?.dropoffDate} ({searchParams?.dropoffTime?.substring(0, 5)})
              • Driver Age: {searchParams?.driverAge || 30} • Currency: {searchParams?.currency || 'USD'}
            </p>
          </div>

          <button
            type="button"
            className="edit-search-toggle-btn"
            onClick={() => setShowEditSearch(v => !v)}
          >
            <i className="fas fa-edit" />
            <span>{showEditSearch ? 'Close Search' : 'Modify Search'}</span>
          </button>
        </div>
      </section>

      {/* Edit Search Form Drawer */}
      {showEditSearch && (
        <section className="car-edit-search-drawer">
          <div className="container">
            <CarSearchForm initialValues={searchParams || {}} compact />
          </div>
        </section>
      )}

      {/* Main Results Container */}
      <div className="container car-results-container">
        {/* Left Filter Sidebar */}
        <aside className="car-filter-sidebar">
          <div className="filter-header">
            <h3><i className="fas fa-sliders-h" /> Filter Cars</h3>
            <button type="button" className="reset-filters-btn" onClick={handleResetFilters}>
              Reset All
            </button>
          </div>

          {/* Vehicle Category */}
          <div className="filter-group">
            <h4>Vehicle Category</h4>
            {CATEGORY_OPTIONS.map(cat => (
              <label key={cat} className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => handleCategoryToggle(cat)}
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>

          {/* Transmission */}
          <div className="filter-group">
            <h4>Transmission</h4>
            {TRANSMISSION_OPTIONS.map(tr => (
              <label key={tr} className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedTransmissions.includes(tr)}
                  onChange={() => handleTransmissionToggle(tr)}
                />
                <span>{tr}</span>
              </label>
            ))}
          </div>

          {/* Mileage */}
          <div className="filter-group">
            <h4>Mileage</h4>
            {MILEAGE_OPTIONS.map(m => (
              <label key={m} className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedMileages.includes(m)}
                  onChange={() => handleMileageToggle(m)}
                />
                <span>{m} Mileage</span>
              </label>
            ))}
          </div>

          {/* Depot Type */}
          <div className="filter-group">
            <h4>Pickup Location Type</h4>
            {DEPOT_TYPES.map(dt => (
              <label key={dt} className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedDepotTypes.includes(dt)}
                  onChange={() => handleDepotTypeToggle(dt)}
                />
                <span>{dt}</span>
              </label>
            ))}
          </div>

          {/* Air Conditioning */}
          <div className="filter-group">
            <h4>Features</h4>
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={airConOnly}
                onChange={e => setAirConOnly(e.target.checked)}
              />
              <span>Air Conditioning Only</span>
            </label>
          </div>
        </aside>

        {/* Right Car Results Listing */}
        <main className="car-results-main">
          
          {/* Controls Bar: Result Count & Sort */}
          <div className="car-controls-bar">
            <span className="results-count-text">
              Showing <strong>{results.length}</strong> rental car options
            </span>

            <div className="sort-select-wrapper">
              <label htmlFor="car-sort-select">Sort by:</label>
              <select
                id="car-sort-select"
                className="car-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Review Score</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="car-loading-state">
              <i className="fas fa-spinner fa-spin car-loading-icon" />
              <h3>Searching available rental cars...</h3>
              <p>Fetching real-time inventory from Booking.com</p>
            </div>
          )}

          {/* Error State */}
          {!loading && errorMsg && (
            <div className="car-error-state">
              <i className="fas fa-exclamation-triangle" />
              <h3>Search Unavailable</h3>
              <p>{errorMsg}</p>
              {requestId && <span className="error-req-id">Reference ID: {requestId}</span>}
              <button
                type="button"
                className="retry-search-btn"
                onClick={() => searchParams && fetchCarResults(searchParams)}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty Results State */}
          {!loading && !errorMsg && results.length === 0 && (
            <div className="car-empty-state">
              <i className="fas fa-car-side" />
              <h3>No rental cars found for these dates and locations</h3>
              <p>Try changing your pickup time, dates, location, or driver age requirement.</p>
              <button
                type="button"
                className="reset-filters-btn-large"
                onClick={handleResetFilters}
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Result Cards List */}
          {!loading && !errorMsg && results.length > 0 && (
            <div className="car-cards-list">
              {results.map((carItem, idx) => (
                <CarResultCard
                  key={carItem.car_id || carItem.id || idx}
                  result={carItem}
                  enrichment={enrichment}
                />
              ))}

              {/* Load More Pagination */}
              {nextPageToken && (
                <div className="load-more-wrapper">
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={() => searchParams && fetchCarResults(searchParams, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <i className="fas fa-spinner fa-spin" /> Loading More...
                      </>
                    ) : (
                      'Load More Cars'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default CarSearchResultsPage;
