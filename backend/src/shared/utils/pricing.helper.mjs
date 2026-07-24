/**
 * Reusable Pricing Helper for The Final Seat
 * Calculates 10% flight discount using integer cents math to eliminate floating point precision errors.
 */

export function calculateFlightDiscount({ originalPrice, isMock = false, currency = 'USD' }) {
  const parsedOriginal = parseFloat(originalPrice || 0);

  if (isNaN(parsedOriginal) || parsedOriginal <= 0) {
    return {
      originalPrice: '0.00',
      originalPriceNum: 0,
      discountPercent: 0,
      discountAmount: '0.00',
      discountAmountNum: 0,
      finalPrice: '0.00',
      finalPriceNum: 0,
      currency: currency.toUpperCase(),
      formattedOriginal: '$0.00',
      formattedDiscount: '$0.00',
      formattedFinal: '$0.00',
      isMock: true,
    };
  }

  const originalCents = Math.round(parsedOriginal * 100);

  if (isMock) {
    const originalPriceStr = (originalCents / 100).toFixed(2);
    const originalPriceNum = originalCents / 100;
    return {
      originalPrice: originalPriceStr,
      originalPriceNum,
      discountPercent: 0,
      discountAmount: '0.00',
      discountAmountNum: 0,
      finalPrice: originalPriceStr,
      finalPriceNum: originalPriceNum,
      currency: currency.toUpperCase(),
      formattedOriginal: `$${originalPriceStr}`,
      formattedDiscount: '$0.00',
      formattedFinal: `$${originalPriceStr}`,
      isMock: true,
    };
  }

  const discountPercent = 10;
  const discountAmountCents = Math.round(originalCents * (discountPercent / 100));
  const finalCents = originalCents - discountAmountCents;

  const originalPriceStr = (originalCents / 100).toFixed(2);
  const discountAmountStr = (discountAmountCents / 100).toFixed(2);
  const finalPriceStr = (finalCents / 100).toFixed(2);

  const originalPriceNum = originalCents / 100;
  const discountAmountNum = discountAmountCents / 100;
  const finalPriceNum = finalCents / 100;

  return {
    originalPrice: originalPriceStr,
    originalPriceNum,
    discountPercent,
    discountAmount: discountAmountStr,
    discountAmountNum,
    finalPrice: finalPriceStr,
    finalPriceNum,
    currency: currency.toUpperCase(),
    formattedOriginal: `$${originalPriceStr}`,
    formattedDiscount: `$${discountAmountStr}`,
    formattedFinal: `$${finalPriceStr}`,
    isMock: false,
  };
}

/**
 * Calculates total booking pricing for single or multiple passengers, outbound & return flights
 */
export function calculateBookingTotal({ outboundFlight, returnFlight = null, passengersCount = 1, currency = 'USD' }) {
  const passCount = Math.max(1, parseInt(passengersCount || 1, 10));

  const outboundCalc = calculateFlightDiscount({
    originalPrice: outboundFlight?.price?.originalApiPrice || outboundFlight?.price?.total || 0,
    isMock: !!outboundFlight?.isMock,
    currency,
  });

  let returnCalc = null;
  if (returnFlight) {
    returnCalc = calculateFlightDiscount({
      originalPrice: returnFlight?.price?.originalApiPrice || returnFlight?.price?.total || 0,
      isMock: !!returnFlight?.isMock,
      currency,
    });
  }

  const isMockBooking = outboundCalc.isMock || (returnCalc && returnCalc.isMock);

  const outboundOriginalCents = Math.round(outboundCalc.originalPriceNum * 100);
  const returnOriginalCents = returnCalc ? Math.round(returnCalc.originalPriceNum * 100) : 0;
  const perPassengerOriginalCents = outboundOriginalCents + returnOriginalCents;
  const totalOriginalCents = perPassengerOriginalCents * passCount;

  const outboundFinalCents = Math.round(outboundCalc.finalPriceNum * 100);
  const returnFinalCents = returnCalc ? Math.round(returnCalc.finalPriceNum * 100) : 0;
  const perPassengerFinalCents = outboundFinalCents + returnFinalCents;
  const totalFinalCents = perPassengerFinalCents * passCount;

  const totalDiscountCents = isMockBooking ? 0 : (totalOriginalCents - totalFinalCents);

  const supplierPriceStr = (totalOriginalCents / 100).toFixed(2);
  const discountAmountStr = (totalDiscountCents / 100).toFixed(2);
  const customerPriceStr = (totalFinalCents / 100).toFixed(2);

  return {
    supplierPrice: supplierPriceStr,
    supplierPriceNum: totalOriginalCents / 100,
    discountPercent: isMockBooking ? 0 : 10,
    discountAmount: discountAmountStr,
    discountAmountNum: totalDiscountCents / 100,
    customerPrice: customerPriceStr,
    customerPriceNum: totalFinalCents / 100,
    passengersCount: passCount,
    currency: currency.toUpperCase(),
    formattedSupplierPrice: `$${supplierPriceStr}`,
    formattedDiscountAmount: `$${discountAmountStr}`,
    formattedCustomerPrice: `$${customerPriceStr}`,
    isMock: isMockBooking,
    outbound: outboundCalc,
    return: returnCalc,
  };
}

export default {
  calculateFlightDiscount,
  calculateBookingTotal,
};
