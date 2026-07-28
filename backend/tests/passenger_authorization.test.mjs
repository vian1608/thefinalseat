import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import assert from 'assert';
import passengerAuthorizationService from '../src/modules/authorizations/passenger-authorization.service.mjs';
import bookingRepository from '../src/modules/bookings/booking.repository.mjs';

async function runAuthorizationTests() {
  console.log('=== RUNNING PASSENGER AUTHORIZATION WORKFLOW TESTS ===\n');

  // Test 1: Create single-use 24-hour authorization token
  console.log('Test 1: Single-use 24-hour authorization token & snapshot creation...');
  const testUuid = '8744e915-a566-41ea-a79a-fe2163bcaf31';
  await bookingRepository.updateStatus(testUuid, { total_amount: 489.60, customer_price: 489.60 });

  const mockBooking = {
    id: testUuid,
    booking_id: testUuid,
    confirmation_code: `TFS-2026-AUTH${Math.floor(1000 + Math.random() * 9000)}`,
    passenger_name: 'Vinod Saini',
    email: 'viansaini1608@gmail.com',
    phone: '+1 213-965-9727',
    customer_price: 489.60,
    total_amount: 489.60,
    currency: 'USD',
    status: 'PENDING',

    payment_status: 'pending',
    passengers: [{ first_name: 'Vinod', last_name: 'Saini' }],
    flights: [
      {
        direction: 'outbound',
        carrier: 'United Airlines',
        flight_number: 'UA 8899',
        origin_code: 'LAX',
        origin_city: 'Los Angeles',
        destination_code: 'JFK',
        destination_city: 'New York',
        departure_date: '2026-09-10T09:00:00Z',
        cabin_class: 'Economy'
      }
    ]
  };

  const vaultData = {
    paymentMethodToken: 'pm_vault_token_9988776655',
    cardBrand: 'Visa',
    cardLast4: '4242'
  };

  const authRecord = await passengerAuthorizationService.createAuthorizationToken(mockBooking, vaultData);
  assert.ok(authRecord.token, 'Token must be generated');
  assert.ok(authRecord.token.length >= 32, 'Token must be generated and valid');

  assert.strictEqual(authRecord.card_last4, '4242', 'Masked card last 4 must be saved');
  assert.strictEqual(authRecord.card_brand, 'Visa', 'Masked card brand must be saved');
  assert.ok(authRecord.expires_at, 'Expiration date must be set');
  console.log(`✔ Test 1 Passed: Single-use token generated (${authRecord.token.substring(0, 16)}...) expiring at ${authRecord.expires_at}`);

  // Test 2: Fetch and validate token payload
  console.log('\nTest 2: Token validation & quote immutability payload retrieval...');
  const payload = await passengerAuthorizationService.getAuthorizationByToken(authRecord.token);
  assert.strictEqual(payload.token, authRecord.token);
  assert.strictEqual(payload.cardLast4, '4242');
  assert.strictEqual(payload.authorizedAmount, '489.60');
  console.log('✔ Test 2 Passed: Token payload validated with exact quote snapshot and masked card info');

  // Test 3: Mandatory wording acceptance & audit recording
  console.log('\nTest 3: Passenger authorization acceptance & text hash calculation...');
  const acceptedText = `I confirm that the passenger names, itinerary, dates, fare, fees and contact information shown above are correct. I authorize The Final Seat to use my previously provided payment method ending in 4242 for a charge of up to 489.60 USD for this reservation. I understand that a new authorization will be required if the itinerary or total amount changes.`;

  const acceptResult = await passengerAuthorizationService.acceptAuthorization({
    token: authRecord.token,
    acceptedCheckboxText: acceptedText,
    clientIp: '198.51.100.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
  });

  assert.strictEqual(acceptResult.success, true);
  assert.strictEqual(acceptResult.status, 'AUTHORIZED');
  console.log('✔ Test 3 Passed: Authorization accepted cleanly. Recorded client IP (198.51.100.45) & SHA-256 text hash');

  // Test 4: Single-use token consumption check
  console.log('\nTest 4: Single-use token reuse prevention check...');
  try {
    await passengerAuthorizationService.acceptAuthorization({
      token: authRecord.token,
      acceptedCheckboxText: acceptedText,
      clientIp: '198.51.100.45',
      userAgent: 'Mozilla/5.0'
    });
    assert.fail('Reusing consumed token should throw error');
  } catch (err) {
    assert.ok(err.message.includes('ALREADY'), 'Consumed token should throw ALREADY_ACCEPTED or ALREADY_CONSUMED');
    console.log('✔ Test 4 Passed: Consumed single-use token rejected duplicate submission attempt');
  }

  // Test 5: Evidence Export generation
  console.log('\nTest 5: Audit evidence export generation...');
  const evidence = await passengerAuthorizationService.generateAuditEvidenceExport(mockBooking.id);
  assert.ok(evidence.evidenceId, 'Evidence ID must be generated');
  assert.strictEqual(evidence.authorization.cardLast4, '4242');
  assert.strictEqual(evidence.authorization.ipAddress, '198.51.100.45');
  assert.ok(evidence.authorization.authorizationTextHash, 'Text SHA-256 hash must be recorded in evidence');
  console.log(`✔ Test 5 Passed: Audit evidence generated (ID: ${evidence.evidenceId}) with full audit trail`);

  console.log('\n🎉 ALL PASSENGER AUTHORIZATION TESTS PASSED SUCCESSFULLY!\n');
}

runAuthorizationTests().catch(err => {
  console.error('❌ Authorization Test Failed:', err);
  process.exit(1);
});
