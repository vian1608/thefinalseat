import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import FlightSearchPanel from '../components/FlightSearchPanel';
import SeniorTravelPage from './SeniorTravelPage';

export default function SeniorTravelSearchPage() {
  const [searchMount, setSearchMount] = useState(null);

  useEffect(() => {
    const hero = document.querySelector('.senior-travel-page .st-hero');
    if (!hero) return undefined;

    const mount = document.createElement('div');
    mount.className = 'st-senior-search-slot';
    hero.insertAdjacentElement('afterend', mount);
    setSearchMount(mount);

    return () => {
      setSearchMount(null);
      mount.remove();
    };
  }, []);

  return (
    <>
      <SeniorTravelPage />

      {searchMount && createPortal(
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
        </section>,
        searchMount
      )}
    </>
  );
}
