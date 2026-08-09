import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }) {
  const location = useLocation();
  const pathname = location.pathname || '/';
  const isAdmin = pathname.startsWith('/admin');
  const isCars = pathname.startsWith('/car-rentals');
  const isRail = pathname.startsWith('/amtrak') || pathname.startsWith('/train-');
  const theme = isAdmin ? 'admin' : (isCars ? 'cars' : (isRail ? 'rail' : 'flights'));

  useEffect(() => {
    document.body.classList.remove('theme-flights', 'theme-rail', 'theme-admin', 'theme-cars');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <div className={`page-transition page-transition--${theme}`}>
      <div className="tfs-route-stage" key={location.key || `${pathname}${location.search}`}>
        {children}
      </div>
    </div>
  );
}

export default PageTransition;
