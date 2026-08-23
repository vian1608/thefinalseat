import assert from 'node:assert/strict';
import { publicTripAddonProjection } from '../src/modules/addons/trip-addon.repository.mjs';

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const internal = {
  version: 'TRIP_ADDONS_V2',
  currency: 'USD',
  flexAssist: { selected: true, rate: 0.10, price: 50, status: 'ACTIVE', termsVersion: 'FLEX_V1' },
  baggage: [
    {
      requestId: 'bag_0_outbound',
      travelerIndex: 0,
      direction: 'OUTBOUND',
      quantity: 1,
      weightKg: 23,
      status: 'AWAITING_PAYMENT',
      customerPrice: 79,
      supplierCost: 45,
      adminNotes: 'Internal supplier portal note must never leave the backend.',
      quoteValidUntil: future,
      paymentUrl: 'https://payments.example.com/baggage/abc',
      paymentStatus: 'AWAITING_PAYMENT',
      supplierReference: 'SUPPLIER-SECRET-BEFORE-CONFIRMATION',
      requiresSeparatePayment: true,
    },
    {
      requestId: 'bag_1_return',
      travelerIndex: 1,
      direction: 'RETURN',
      quantity: 2,
      weightKg: 23,
      status: 'CONFIRMED',
      customerPrice: 149,
      supplierCost: 100,
      adminNotes: 'Internal note',
      quoteValidUntil: future,
      paymentUrl: 'http://insecure.example.com/pay',
      paymentStatus: 'PAID',
      supplierReference: 'AIRLINE-CONF-123',
      requiresSeparatePayment: true,
    },
    {
      requestId: 'bag_2_outbound',
      travelerIndex: 2,
      direction: 'OUTBOUND',
      quantity: 1,
      weightKg: 23,
      status: 'OFFER_SENT',
      customerPrice: 89,
      supplierCost: 50,
      quoteValidUntil: past,
      paymentUrl: 'https://payments.example.com/expired',
      paymentStatus: 'AWAITING_PAYMENT',
      requiresSeparatePayment: true,
    },
  ],
};

const projected = publicTripAddonProjection(internal);
assert.equal(projected.version, 'TRIP_ADDONS_V2');
assert.equal(projected.flexAssist.price, 50);
assert.equal(projected.baggage.length, 3);

assert.equal(projected.baggage[0].status, 'AWAITING_PAYMENT');
assert.equal(projected.baggage[0].customerPrice, 79);
assert.equal(projected.baggage[0].paymentUrl, 'https://payments.example.com/baggage/abc');
assert.equal(projected.baggage[0].supplierReference, null);
assert.equal('supplierCost' in projected.baggage[0], false);
assert.equal('adminNotes' in projected.baggage[0], false);

assert.equal(projected.baggage[1].status, 'CONFIRMED');
assert.equal(projected.baggage[1].paymentUrl, null);
assert.equal(projected.baggage[1].supplierReference, 'AIRLINE-CONF-123');
assert.equal('supplierCost' in projected.baggage[1], false);
assert.equal('adminNotes' in projected.baggage[1], false);

assert.equal(projected.baggage[2].status, 'PRICE_EXPIRED');
assert.equal(projected.baggage[2].paymentUrl, null);
assert.equal(projected.baggage[2].paymentStatus, 'NOT_REQUIRED_YET');
assert.match(projected.baggage[2].message, /expired/i);

console.log('baggage post-reservation contract: PASS');
