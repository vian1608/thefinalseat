import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './shared/styles/ProductionSafetyOverrides.css';
import './shared/styles/ModernInteractionSystem.css';
import './shared/styles/ModernDetailsMotion.css';
import './shared/styles/BookingFlowOverrides.css';
import './shared/styles/BookingValidationUX.css';
import './shared/styles/ItineraryPriceLayoutFix.css';
import './shared/styles/FareBreakdownUX.css';
import './shared/styles/ItineraryDirectionFix.css';
import './shared/styles/MobileBookingUX.css';
import './shared/styles/BookingChoiceUX.css';
import './shared/styles/MobileItineraryCompact.css';
import './shared/styles/MobileItineraryRoutePolish.css';
import App from './app/App';
import BackOfficeRouter from './features/backoffice/BackOfficeRouter';
import { HelmetProvider } from 'react-helmet-async';
import { installSensitiveDataGuards } from './shared/security/installSensitiveDataGuards';
import { installBookingValidationUX } from './shared/validation/installBookingValidationUX';
import { installFareBreakdownUX } from './shared/pricing/installFareBreakdownUX';
import { installMobileBookingUX } from './shared/mobile/installMobileBookingUX';
import { installPrimaryContactSyncUX } from './shared/contact/installPrimaryContactSyncUX';

installSensitiveDataGuards();
installBookingValidationUX();
installFareBreakdownUX();
installMobileBookingUX();
installPrimaryContactSyncUX();

// Preserve every established App.js route. Only the new additive back-office URLs
// are intercepted here so the stable flight/admin route table does not need a rewrite.
const isNewBackOfficePath = /^\/admin\/(backoffice|crm(?:\/|$)|trips(?:\/|$)|bookings\/(?:flights|hotels|cars)(?:\/|$)|payments(?:\/|$)|finance(?:\/|$)|suppliers(?:\/|$)|reports(?:\/|$)|team(?:\/|$)|settings(?:\/|$))/.test(window.location.pathname);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      {isNewBackOfficePath ? <BrowserRouter><BackOfficeRouter /></BrowserRouter> : <App />}
    </HelmetProvider>
  </React.StrictMode>
);
