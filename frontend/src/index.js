import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './shared/styles/ProductionSafetyOverrides.css';
import App from './app/App';
import { HelmetProvider } from 'react-helmet-async';
import { installSensitiveDataGuards } from './shared/security/installSensitiveDataGuards';

installSensitiveDataGuards();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
