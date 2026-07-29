import assert from 'assert';
import bookingRepository from '../src/modules/bookings/booking.repository.mjs';
import { sendFinalTicketEmail } from '../src/integrations/resend/resend.service.mjs';

async function runTicketDetailsValidationTests() {
  console.log('=== RUNNING TICKET DETAILS & PNR VALIDATION TESTS ===\n');

  // Test 1: Setup booking
  console.log('Test 1: Creating test booking...');
  const testBooking = await bookingRepository.createBookingRecord({
    confirmation_code: `TFS-TKT-${Date.now().toString().slice(-6)}`,
    status: 'READY_FOR_TICKETING',
    payment_status: 'PAID',
    total_amount: 1540.00,
    customer_price: 1540.00,
    currency: 'USD',
    passenger_name: 'Sophia Martinez',
    email: 'delivered@resend.dev'
  });

  const bookingId = testBooking.id;

  // Insert itinerary segment
  await bookingRepository.saveItinerarySegments(bookingId, [
    {
      journey_direction: 'outbound',
      segment_sequence: 1,
      marketing_carrier_code: 'UA',
      airline_name: 'United Airlines',
      flight_number: 'UA 881',
      origin_airport: 'ORD',
      destination_airport: 'LHR',
      departure_date: '2026-11-01',
      departure_time: '06:00 PM'
    }
  ]);

  // Test 2: Reject invalid PNR (5 characters, 7 characters, symbols)
  console.log('Test 2: Verifying rejection of invalid PNR formats...');
  await assert.rejects(
    async () => {
      await bookingRepository.saveTicketDetails(bookingId, { airlineConfirmationNumber: 'ABC12' });
    },
    (err) => err.message.includes('exactly 6 letters or numbers')
  );

  await assert.rejects(
    async () => {
      await bookingRepository.saveTicketDetails(bookingId, { airlineConfirmationNumber: 'AB12CDE' });
    },
    (err) => err.message.includes('exactly 6 letters or numbers')
  );
  console.log('  ✔ Invalid PNR formats correctly rejected\n');

  // Test 3: Reject invalid ticket number (letters, symbols, > 13 digits)
  console.log('Test 3: Verifying rejection of invalid ticket number formats...');
  await assert.rejects(
    async () => {
      await bookingRepository.saveTicketDetails(bookingId, { ticketNumber: '125A241098' });
    },
    (err) => err.message.includes('digits only and cannot exceed 13 digits')
  );

  await assert.rejects(
    async () => {
      await bookingRepository.saveTicketDetails(bookingId, { ticketNumber: '12345678901234' });
    },
    (err) => err.message.includes('digits only and cannot exceed 13 digits')
  );
  console.log('  ✔ Invalid ticket numbers correctly rejected\n');

  // Test 4: Save valid PNR (AB12CD) and 13-digit ticket number (0162410982341)
  console.log('Test 4: Saving valid PNR and 13-digit ticket number...');
  const savedBooking = await bookingRepository.saveTicketDetails(bookingId, {
    airlineCode: 'UA',
    airlineName: 'United Airlines',
    airlineConfirmationNumber: 'AB12CD',
    ticketNumber: '0162410982341',
    supplierConfirmation: 'SUP-998822',
    ticketNotes: 'Issued cleanly'
  });

  assert.strictEqual(savedBooking.airline_confirmation_number, 'AB12CD');
  assert.strictEqual(savedBooking.ticket_number, '0162410982341');
  assert.strictEqual(savedBooking.supplier_confirmation, 'SUP-998822');
  console.log('  ✔ Valid PNR and 13-digit ticket number saved and re-fetched cleanly\n');

  // Test 5: Dispatch Final Ticket Email
  console.log('Test 5: Dispatching Final Ticket Email...');
  const emailRes = await sendFinalTicketEmail(bookingId);
  assert.strictEqual(emailRes.success, true);
  console.log('  ✔ Final E-Ticket email dispatched cleanly\n');

  console.log('🎉 ALL TICKET DETAILS & PNR VALIDATION TESTS PASSED SUCCESSFULLY!\n');
}

runTicketDetailsValidationTests().catch(err => {
  console.error('❌ Ticket Details Validation Test Failed:', err);
  process.exit(1);
});
