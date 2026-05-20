import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import './RouteSlider.css';

const RouteSlider = ({ routes, btnClassPrefix = 'flights' }) => {
  const sliderRef = useRef(null);

  const scroll = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = 300; // rough width of one card + gap
      sliderRef.current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="route-slider-container">
      <div className="route-slider-header">
        <h2 className={`${btnClassPrefix}-section__title`} style={{ margin: 0 }}>Famous Routes</h2>
        <div className="route-slider-controls">
          <button className="slider-control-btn" onClick={() => scroll(-1)} aria-label="Scroll left">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button className="slider-control-btn" onClick={() => scroll(1)} aria-label="Scroll right">
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
      
      <div className="route-slider" ref={sliderRef}>
        {routes.map((route, idx) => (
          <article className="route-slider-card" key={idx}>
            <div className="route-slider-img-container">
              <img src={route.image} alt={route.title} loading="lazy" />
            </div>
            <div className="route-slider-content">
              <h3>{route.title}</h3>
              <p>{route.desc}</p>
              <Link to={route.path} className={`${btnClassPrefix}-btn ${btnClassPrefix}-btn--cta`} style={{ width: '100%', marginTop: 'auto' }}>
                Book Now
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default RouteSlider;
