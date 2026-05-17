import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Booking from './pages/Booking';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import OneWayConfirmation from './pages/OneWayConfirmation';
import RoundTripConfirmation from './pages/RoundTripConfirmation';
import ReturnFlightSelection from './pages/ReturnFlightSelection';
import TermsAndConditions from './pages/TermsAndConditions';
import ContactInfo from './pages/ContactInfo';
import './App.css';
import PrivacyPolicy from './pages/privacypolicy';
import RefundPolicy from './pages/refundpolicy';
import AmtrakAssistance from './pages/AmtrakAssistance';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main">
          <PageTransition>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/amtrak-assistance" element={<AmtrakAssistance />} />
              <Route path="/amtrak-assisstance" element={<Navigate to="/amtrak-assistance" replace />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/confirmation/one-way" element={<OneWayConfirmation />} />
              <Route path="/confirmation/round-trip" element={<RoundTripConfirmation />} />
              <Route path="/return-flight" element={<ReturnFlightSelection />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/contact" element={<ContactInfo />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/privacypolicy" element={<PrivacyPolicy />} />
              <Route path="/refundpolicy" element={<RefundPolicy />} />
            </Routes>
          </PageTransition>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
