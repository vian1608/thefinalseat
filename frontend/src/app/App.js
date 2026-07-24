import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Header from '../shared/components/Header';
import Footer from '../shared/components/Footer';
import PageTransition from '../shared/components/PageTransition';
import ScrollToTop from '../shared/components/ScrollToTop';
import Home from '../features/flights/pages/Home';
import SearchResults from '../features/flights/pages/SearchResultsPage';
import SignIn from '../features/customers/pages/SignInPage';
import SignUp from '../features/customers/pages/SignUpPage';
import AdminLogin from '../features/admin/pages/AdminLoginPage';
import AdminDashboard from '../features/admin/pages/AdminDashboardPage';
import OneWayConfirmation from '../features/bookings/pages/OneWayConfirmationPage';
import RoundTripConfirmation from '../features/bookings/pages/RoundTripConfirmationPage';
import ReturnFlightSelection from '../features/flights/pages/ReturnFlightSelectionPage';
import TermsAndConditions from '../shared/pages/TermsAndConditionsPage';
import ContactInfo from '../shared/pages/ContactInfoPage';
import './App.css';
import PrivacyPolicy from '../shared/pages/PrivacyPolicyPage';
import RefundPolicy from '../shared/pages/RefundPolicyPage';
import AmtrakAssistance from '../features/flights/pages/AmtrakAssistancePage';
import TrainRoute from '../features/flights/pages/TrainRoutePage';
import FlightRoute from '../features/flights/pages/FlightRoutePage';
import AirlineActionPage from '../features/flights/pages/AirlineActionPage';
import ConsultingPayment from '../features/payments/pages/ConsultingPaymentPage';
import RouteDispatcher from '../features/flights/pages/RouteDispatcher';
import Booking from '../features/bookings/pages/BookingPage';
import PaymentSuccess from '../features/bookings/pages/PaymentSuccessPage';
import MyBookings from '../features/bookings/pages/MyBookingsPage';
import AppErrorBoundary from '../shared/components/AppErrorBoundary';

function LegacyAirlineRedirect() {
  const { airlineSlug } = useParams();
  return <Navigate to={`/book/${airlineSlug}`} replace />;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="App">
        <Header />
        <main className="main">
          <AppErrorBoundary>
            <PageTransition>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/amtrak" element={<AmtrakAssistance />} />
                <Route path="/amtrak-assistance" element={<Navigate to="/amtrak" replace />} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />

                {/* Train Routes */}
                <Route path="/train-nyc-to-dc" element={
                  <TrainRoute 
                    title="Train from NYC to Washington, D.C." 
                    metaTitle="Train from NYC to DC | Book Tickets & Schedules | The Final Seat"
                    metaDescription="Need a train from NYC to Washington DC? Get optimized schedules, seat selections, and seamless ticketing assistance on the Northeast Corridor."
                    keywords="train from nyc to dc, train new york washington, new york to washington dc train, train to new york"
                    originCity="New York City"
                    destinationCity="Washington, D.C."
                    originCode="NYC"
                    destinationCode="DC"
                  />
                } />
                <Route path="/train-dc-to-nyc" element={
                  <TrainRoute 
                    title="Train from D.C. to New York City" 
                    metaTitle="Train from DC to NYC | Schedules & Easy Booking | The Final Seat"
                    metaDescription="Find the fastest train routes from Washington DC to New York City. Plan your Northeast Corridor travel with zero hassle or booking stress."
                    keywords="train from dc to nyc, train to new york from dc, new york to dc train, boston to nyc train"
                    originCity="Washington, D.C."
                    destinationCity="New York City"
                    originCode="DC"
                    destinationCode="NYC"
                  />
                } />
                <Route path="/train-philly-to-nyc" element={
                  <TrainRoute 
                    title="Train from Philadelphia to NYC" 
                    metaTitle="Train from Philly to NYC | Fast Passenger Routing | The Final Seat"
                    metaDescription="Coordination and support for train travel from Philadelphia to NYC. Book your Amtrak or regional commuter seats instantly."
                    keywords="train from philly to nyc, train from nyc to philadelphia, buy train tickets, amtrak tickets"
                    originCity="Philadelphia"
                    destinationCity="New York City"
                    originCode="PHL"
                    destinationCode="NYC"
                  />
                } />
                <Route path="/train-boston-to-nyc" element={
                  <TrainRoute 
                    title="Train from Boston to NYC" 
                    metaTitle="Train from Boston to NYC | Premium Tickets | The Final Seat"
                    metaDescription="Expert logistics for Northeast Corridor rail from Boston to New York City."
                    keywords="boston to nyc train, train to new york from boston, amtrak boston to nyc"
                    originCity="Boston"
                    destinationCity="New York City"
                    originCode="BOS"
                    destinationCode="NYC"
                  />
                } />

                {/* Flight Routes */}
                <Route path="/flight-nyc-to-mia" element={
                  <FlightRoute 
                    title="Flights from NYC to Miami (MIA)" 
                    metaTitle="Flights from NYC to Miami | Fast Booking & Deals | The Final Seat"
                    metaDescription="Find best flight deals and seamless advisory for non-stop flights from New York to Miami."
                    keywords="flights from nyc to mia, new york to miami flights, nyc to miami plane tickets"
                    originCity="New York City"
                    destinationCity="Miami"
                    originCode="NYC"
                    destinationCode="MIA"
                  />
                } />
                <Route path="/flight-lax-to-jfk" element={
                  <FlightRoute 
                    title="Flights from Los Angeles (LAX) to New York (JFK)" 
                    metaTitle="Flights from LAX to JFK | Transcontinental Deals | The Final Seat"
                    metaDescription="Book premium transcontinental flights from Los Angeles to New York JFK with expert logistics."
                    keywords="flights from lax to jfk, los angeles to new york flights, lax to jfk tickets"
                    originCity="Los Angeles"
                    destinationCity="New York"
                    originCode="LAX"
                    destinationCode="JFK"
                  />
                } />

                {/* Dynamic & Landing Routes */}
                <Route path="/routes/:slug" element={<RouteDispatcher />} />
                <Route path="/book/:airline" element={<AirlineActionPage action="book" />} />
                <Route path="/changes/:airline" element={<AirlineActionPage action="changes" />} />
                <Route path="/cancellation/:airline" element={<AirlineActionPage action="cancellation" />} />
                <Route path="/airlines/:airlineSlug" element={<LegacyAirlineRedirect />} />

                {/* Flight & App Routes */}
                <Route path="/search" element={<SearchResults />} />
                <Route path="/payment" element={<ConsultingPayment />} />
                <Route path="/pay" element={<Navigate to="/payment" replace />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/confirmation/success" element={<PaymentSuccess />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
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
                
                {/* Catch-all 404 Redirect to Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PageTransition>
          </AppErrorBoundary>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
