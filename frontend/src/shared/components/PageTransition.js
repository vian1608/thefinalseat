import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }) {
  const location = useLocation();
  const isRail = location.pathname.startsWith('/amtrak');

  useEffect(() => {
    document.body.classList.remove('theme-flights', 'theme-rail');
    document.body.classList.add(isRail ? 'theme-rail' : 'theme-flights');
  }, [isRail]);

  return (
    <div className={`page-transition page-transition--${isRail ? 'rail' : 'flights'}`}>
      {children}
    </div>
  );
}

export default PageTransition;
