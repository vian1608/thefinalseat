import assert from 'node:assert/strict';
import {
  buildAuthoritativeTripAddonQuote,
  applyAuthoritativeTripAddonPricing,
} from '../src/modules/addons/trip-addon-pricing.service.mjs';

const checkout = {
  searchParams: { adults: 2, children: 0, infants: 0 },
  selectedFlight: { price: { finalPrice: 300 } },
  returnFlight: { price: { finalPrice: 200 } },
  addons: {
    flexAssist: { selected: true, price: 1, rate: 0.01 },
    baggage: [
      { travelerIndex: 0, direction: 'OUTBOUND', quantity: 1, unitPrice: 999, customerPrice: 999 },
      { travelerIndex: 1, direction: 'RETURN', quantity: 2, unitPrice: 999, customerPrice: 999 },
    ],
  },
};

const quote = buildAuthoritativeTripAddonQuote(checkout);
assert.equal(quote.version, 'TRIP_ADDONS_V2');
assert.equal(quote.ticketBase, 1000);
assert.equal(quote.flexAssist.rate, 0.10);
assert.equal(quote.flexAssist.price, 100);
assert.equal(quote.addOnTotal, 100);
assert.equal(quote.baggagePaymentDueNow, 0);
assert.equal(quote.baggage.length, 2);
assert.equal(quote.baggage[0].priceMode, 'POST_RESERVATION_QUOTE');
assert.equal(quote.baggage[0].paymentDueNow, 0);
assert.equal(quote.baggage[0].supplierCost, null);
assert.equal(quote.baggage[0].customerPrice, null);
assert.equal(quote.baggage[0].status, 'REQUESTED');
assert.equal(quote.baggage[0].paymentStatus, 'NOT_REQUIRED_YET');
assert.equal(quote.baggage[0].requiresSeparatePayment, true);
assert.equal(quote.baggage[1].paymentDueNow, 0);

const priced = applyAuthoritativeTripAddonPricing({
  customer_price: 1,
  voucher_discount: 50,
  minimum_payable_floor: 0,
}, quote);
assert.equal(priced.ticket_component_total, 950);
assert.equal(priced.flex_assist_fee, 100);
assert.equal(priced.add_on_total, 100);
assert.equal(priced.customer_price, 1050);
assert.equal(priced.price_before_voucher, 1100);

const noFlex = buildAuthoritativeTripAddonQuote({
  searchParams: { adults: 1 },
  selectedFlight: { price: { finalPrice: 400 } },
  addons: { flexAssist: { selected: false }, baggage: [{ travelerIndex: 99, direction: 'OUTBOUND', quantity: 3 }] },
});
assert.equal(noFlex.flexAssist.price, 0);
assert.equal(noFlex.addOnTotal, 0);
assert.equal(noFlex.baggage.length, 0);

console.log('trip add-ons pricing contract: PASS');
