import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './shared/styles/ProductionSafetyOverrides.css';
import './shared/styles/ModernInteractionSystem.css';
import './shared/styles/ModernDetailsMotion.css';
import './shared/styles/BookingFlowOverrides.css';
import './shared/styles/BookingValidationUX.css';
import './shared/styles/ItineraryPriceLayoutFix.css';
import App from './app/App';
import { HelmetProvider } from 'react-helmet-async';
import { installSensitiveDataGuards } from './shared/security/installSensitiveDataGuards';
import { installBookingValidationUX } from './shared/validation/installBookingValidationUX';

installSensitiveDataGuards();
installBookingValidationUX();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
