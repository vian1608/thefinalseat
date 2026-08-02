import React, { useState, useRef } from 'react';
import analytics from '../utils/analytics';
import './HowTheFinalSeatHelps.css';

const TABS = [
  { id: 'who_we_help', label: 'Who We Help' },
  { id: 'why_choose_us', label: 'Why Choose Us' },
  { id: 'what_we_compare', label: 'What We Compare' },
];

const TAB_DATA = {
  who_we_help: [
    {
      icon: 'fas fa-user-check',
      title: 'Personal Assistance',
      description: 'Travelers who prefer personal booking assistance over automated forms.',
    },
    {
      icon: 'fas fa-users',
      title: 'Family Booking',
      description: 'Families arranging flights for parents, relatives or friends.',
    },
    {
      icon: 'fas fa-route',
      title: 'Complex Routes',
      description: 'Passengers comparing complex routes or multiple connecting flights.',
    },
    {
      icon: 'fas fa-suitcase-rolling',
      title: 'Fare & Baggage Rules',
      description: 'Travelers who want help understanding baggage allowances and fare conditions.',
    },
  ],
  why_choose_us: [
    {
      icon: 'fas fa-headset',
      title: 'Personal Travel Assistance',
      description: 'Get help comparing flights, routes, baggage rules and travel options.',
    },
    {
      icon: 'fas fa-heart',
      title: 'Support For Family Bookings',
      description: 'Book flights for parents, relatives and travelers who need extra assistance.',
    },
    {
      icon: 'fas fa-balance-scale',
      title: 'More Than Just The Cheapest Fare',
      description: 'We help you understand connections, travel time, baggage and total journey quality.',
    },
    {
      icon: 'fas fa-check-circle',
      title: 'Simple Reservation Experience',
      description: 'Clear information and human support from search to confirmation.',
    },
  ],
  what_we_compare: [
    {
      icon: 'fas fa-plane-arrival',
      title: 'Number of Stops',
      description: 'Help identifying more manageable options with minimal connections.',
    },
    {
      icon: 'fas fa-clock',
      title: 'Connection Duration',
      description: 'Sufficient layover times for comfortable airport transfers.',
    },
    {
      icon: 'fas fa-exchange-alt',
      title: 'Airport Changes',
      description: 'Clear warnings for terminal or airport transfers between legs.',
    },
    {
      icon: 'fas fa-stopwatch',
      title: 'Total Journey Time',
      description: 'Balancing duration, comfort, and schedule convenience.',
    },
    {
      icon: 'fas fa-luggage-cart',
      title: 'Baggage Allowance',
      description: 'Guidance on included baggage rules and carry-on limits.',
    },
    {
      icon: 'fas fa-shield-alt',
      title: 'Refund & Change Rules',
      description: 'Clear explanations of ticket flexibility and cancellation terms.',
    },
    {
      icon: 'fas fa-sun',
      title: 'Departure & Arrival Times',
      description: 'Convenient daytime schedules when available for easier travel.',
    },
    {
      icon: 'fas fa-wheelchair',
      title: 'Mobility Assistance',
      description: 'Help requesting airport assistance and special handling when needed.',
    },
  ],
};

function HowTheFinalSeatHelps() {
  const [activeTab, setActiveTab] = useState('who_we_help');
  const [cardIndex, setCardIndex] = useState(0);
  const touchStartX = useRef(null);

  const cards = TAB_DATA[activeTab] || [];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCardIndex(0);
    analytics.trackMobileHelpTabSelected(tabId);
    const firstCard = (TAB_DATA[tabId] || [])[0];
    if (firstCard) {
      analytics.trackMobileHelpCardViewed(tabId, firstCard.title, 0);
    }
  };

  const handlePrev = () => {
    const newIdx = (cardIndex - 1 + cards.length) % cards.length;
    setCardIndex(newIdx);
    if (cards[newIdx]) {
      analytics.trackMobileHelpCardViewed(activeTab, cards[newIdx].title, newIdx);
    }
  };

  const handleNext = () => {
    const newIdx = (cardIndex + 1) % cards.length;
    setCardIndex(newIdx);
    if (cards[newIdx]) {
      analytics.trackMobileHelpCardViewed(activeTab, cards[newIdx].title, newIdx);
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  const currentCard = cards[cardIndex] || cards[0];

  return (
    <section className="how-helps-section" aria-label="How The Final Seat Helps">
      <div className="container">
        <div className="how-helps-header">
          <h2>How The Final Seat Helps</h2>
          <p className="how-helps-sub">
            Explore who we assist, why travelers choose us and what we review beyond price.
          </p>
        </div>

        {/* Segmented Control / Tab list */}
        <div className="how-helps-tablist" role="tablist" aria-label="Help categories">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                className={`how-helps-tab ${isActive ? 'how-helps-tab--active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Panel & Manual Card Carousel */}
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="how-helps-panel"
        >
          <div
            className="how-helps-carousel"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              className="how-helps-arrow how-helps-arrow--prev"
              onClick={handlePrev}
              aria-label="Previous card"
            >
              <i className="fas fa-chevron-left" aria-hidden="true" />
            </button>

            <div className="how-helps-card-stage">
              {currentCard && (
                <div key={`${activeTab}-${cardIndex}`} className="how-helps-card">
                  <div className="how-helps-icon">
                    <i className={currentCard.icon} aria-hidden="true" />
                  </div>
                  <h3>{currentCard.title}</h3>
                  <p>{currentCard.description}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="how-helps-arrow how-helps-arrow--next"
              onClick={handleNext}
              aria-label="Next card"
            >
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </button>
          </div>

          {/* Dots Pagination */}
          <div className="how-helps-dots" role="tablist" aria-label="Card pagination">
            {cards.map((cardItem, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === cardIndex}
                aria-label={`Go to card ${idx + 1}: ${cardItem.title}`}
                className={`how-helps-dot ${idx === cardIndex ? 'how-helps-dot--active' : ''}`}
                onClick={() => {
                  setCardIndex(idx);
                  analytics.trackMobileHelpCardViewed(activeTab, cardItem.title, idx);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowTheFinalSeatHelps;
