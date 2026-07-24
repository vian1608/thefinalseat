import assert from 'node:assert/strict';
import { calculateFlightDiscount, calculateBookingTotal } from '../src/shared/utils/pricing.helper.mjs';

console.log('--- Running Pricing Helper Unit Tests ---');

// Test 1: $500.00 → $450.00 (save $50.00, 10% OFF)
const test1 = calculateFlightDiscount({ originalPrice: 500.00, isMock: false });
assert.equal(test1.originalPrice, '500.00', 'Original price should be 500.00');
assert.equal(test1.discountPercent, 10, 'Discount percent should be 10');
assert.equal(test1.discountAmount, '50.00', 'Discount amount should be 50.00');
assert.equal(test1.finalPrice, '450.00', 'Final price should be 450.00');
assert.equal(test1.formattedOriginal, '$500.00');
assert.equal(test1.formattedFinal, '$450.00');
assert.equal(test1.formattedDiscount, '$50.00');
console.log('✔ Test 1 Passed: $500.00 → $450.00 (Save $50.00)');

// Test 2: $199.99 → $179.99 (save $20.00, 10% OFF)
const test2 = calculateFlightDiscount({ originalPrice: 199.99, isMock: false });
assert.equal(test2.originalPrice, '199.99');
assert.equal(test2.discountPercent, 10);
assert.equal(test2.discountAmount, '20.00');
assert.equal(test2.finalPrice, '179.99');
assert.equal(test2.formattedOriginal, '$199.99');
assert.equal(test2.formattedFinal, '$179.99');
assert.equal(test2.formattedDiscount, '$20.00');
console.log('✔ Test 2 Passed: $199.99 → $179.99 (Save $20.00)');

// Test 3: No discount on offline / mock flights
const test3 = calculateFlightDiscount({ originalPrice: 280.00, isMock: true });
assert.equal(test3.originalPrice, '280.00');
assert.equal(test3.discountPercent, 0, 'Mock flights should have 0% discount');
assert.equal(test3.discountAmount, '0.00');
assert.equal(test3.finalPrice, '280.00');
assert.equal(test3.isMock, true);
console.log('✔ Test 3 Passed: Mock flight produces 0% discount ($280.00 → $280.00)');

// Test 4: Multi-passenger calculation (2 passengers on $500.00 flight)
const test4 = calculateBookingTotal({
  outboundFlight: { price: { originalApiPrice: '500.00' }, isMock: false },
  passengersCount: 2
});
assert.equal(test4.supplierPrice, '1000.00', 'Supplier price for 2 passengers should be 1000.00');
assert.equal(test4.discountAmount, '100.00', 'Total discount for 2 passengers should be 100.00');
assert.equal(test4.customerPrice, '900.00', 'Customer price for 2 passengers should be 900.00');
console.log('✔ Test 4 Passed: Multi-passenger (2x $500 = $1000 supplier → $900 customer)');

// Test 5: Round-trip calculation (Outbound $500.00 + Return $199.99)
const test5 = calculateBookingTotal({
  outboundFlight: { price: { originalApiPrice: '500.00' }, isMock: false },
  returnFlight: { price: { originalApiPrice: '199.99' }, isMock: false },
  passengersCount: 1
});
assert.equal(test5.supplierPrice, '699.99', 'Supplier total should be 699.99');
assert.equal(test5.discountAmount, '70.00', 'Total discount should be 70.00');
assert.equal(test5.customerPrice, '629.99', 'Customer total should be 629.99');
console.log('✔ Test 5 Passed: Round-trip ($500 + $199.99 = $699.99 supplier → $629.99 customer)');

// Test 6: Payment amount matching (customerPriceNum matches customerPrice string)
assert.equal(parseFloat(test5.customerPrice), test5.customerPriceNum);
assert.equal(parseFloat(test4.customerPrice), test4.customerPriceNum);
assert.equal(parseFloat(test1.finalPrice), test1.finalPriceNum);
console.log('✔ Test 6 Passed: Payment amount exact string & number matching');

console.log('🎉 ALL PRICING HELPER UNIT TESTS PASSED SUCCESSFULLY!');
