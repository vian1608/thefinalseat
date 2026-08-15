import React from 'react';
import FlightSearchPanel from '../components/FlightSearchPanel';
import SeniorTravelPage from './SeniorTravelPage';

export default function SeniorTravelSearchPage() {
  return (
    <>
      <section
        className="st-section st-section--alt"
        aria-label="Search flights for senior travel"
        style={{ paddingTop: '40px', paddingBottom: '40px' }}
      >
        <div className="container">
          <FlightSearchPanel
            pageId="senior-travel-flight-deals"
            title="Search Flights"
            subtitle="Enter your route and travel dates to compare available flight options. Personal booking assistance is still available below if you would like help."
          />
        </div>
      </section>

      <SeniorTravelPage />
    </>
  );
}
