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
import TrainRoute from './pages/TrainRoute';
import FlightRoute from './pages/FlightRoute';

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
              
              {/* New Optimized Train Routes */}
              <Route path="/train-nyc-to-dc" element={
                <TrainRoute 
                  title="Train from NYC to Washington, D.C." 
                  metaTitle="Train from NYC to DC | Book Tickets & Schedules | The Final Seat"
                  metaDescription="Need a train from NYC to Washington DC? Get optimized schedules, seat selections, and seamless ticketing assistance on the Northeast Corridor."
                  keywords="train from nyc to dc, train new york washington, new york to washington dc train, train to new york"
                />
              } />
              <Route path="/train-dc-to-nyc" element={
                <TrainRoute 
                  title="Train from D.C. to New York City" 
                  metaTitle="Train from DC to NYC | Schedules & Easy Booking | The Final Seat"
                  metaDescription="Find the fastest train routes from Washington DC to New York City. Plan your Northeast Corridor travel with zero hassle or booking stress."
                  keywords="train from dc to nyc, train to new york from dc, new york to dc train, boston to nyc train"
                />
              } />
              <Route path="/train-philly-to-nyc" element={
                <TrainRoute 
                  title="Train from Philadelphia to NYC" 
                  metaTitle="Train from Philly to NYC | Fast Passenger Routing | The Final Seat"
                  metaDescription="Coordination and support for train travel from Philadelphia to NYC. Book your Amtrak or regional commuter seats instantly."
                  keywords="train from philly to nyc, train from nyc to philadelphia, buy train tickets, amtrak tickets"
                />
              } />

              {/* New Optimized Flight Routes */}
              <Route path="/flight-nyc-to-lon" element={
                <FlightRoute 
                  title="Flights from New York (JFK) to London (LHR)" 
                  metaTitle="Flights from New York to London | The Final Seat"
                  metaDescription="Book premium routing and travel logistics for flights from New York JFK to London Heathrow."
                  keywords="flights from new york to london, jfk to lhr, new york to london flights"
                />
              } />
              <Route path="/flight-lax-to-tokyo" element={
                <FlightRoute 
                  title="Flights from Los Angeles (LAX) to Tokyo (NRT/HND)" 
                  metaTitle="Flights from LAX to Tokyo | The Final Seat"
                  metaDescription="Seamless premium flight bookings from Los Angeles to Tokyo Narita or Haneda."
                  keywords="flights from los angeles to tokyo, lax to nrt, lax to tokyo flights"
                />
              } />
              <Route path="/flight-mia-to-paris" element={
                <FlightRoute 
                  title="Flights from Miami (MIA) to Paris (CDG)" 
                  metaTitle="Flights from Miami to Paris | The Final Seat"
                  metaDescription="Expert logistics and premium bookings for flights from Miami to Paris Charles de Gaulle."
                  keywords="flights from miami to paris, mia to cdg, miami to paris flights"
                />
              } />

              <Route path="/amtrak-assitance" element={<Navigate to="/amtrak-assistance" replace />} />
              <Route path="/amtrak-assisstance" element={<Navigate to="/amtrak-assistance" replace />} />
              <Route path="/amtrak-asistance" element={<Navigate to="/amtrak-assistance" replace />} />
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
              
              {/* Common Aliases / Shortcuts */}
              <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
              <Route path="/privacypolicy" element={<Navigate to="/privacy-policy" replace />} />
              <Route path="/refund" element={<Navigate to="/refund-policy" replace />} />
              <Route path="/refundpolicy" element={<Navigate to="/refund-policy" replace />} />
            </Routes>
          </PageTransition>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
