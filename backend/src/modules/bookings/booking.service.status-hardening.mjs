import bookingService from './booking.service.mjs';

const ALLOWED_PAYMENT_STATES = new Set(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED']);

if (!bookingService.__canonicalPaymentStateHardening) {
  const originalUpdatePayment = bookingService.updatePayment.bind(bookingService);

  bookingService.updatePayment = async (id, paymentData = {}) => {
    const raw = paymentData.paymentState ?? paymentData.paymentStatus;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const normalized = String(raw).trim().toUpperCase();
      if (!ALLOWED_PAYMENT_STATES.has(normalized)) {
        const error = new Error(`Invalid payment status '${raw}'. Allowed payment states are: ${Array.from(ALLOWED_PAYMENT_STATES).join(', ')}. Passenger authorization belongs to booking authorization_status, not payment_status.`);
        error.code = 'INVALID_PAYMENT_STATUS';
        error.status = 400;
        throw error;
      }
      paymentData = { ...paymentData, paymentState: normalized, paymentStatus: normalized };
    }
    return originalUpdatePayment(id, paymentData);
  };

  Object.defineProperty(bookingService, '__canonicalPaymentStateHardening', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

export { ALLOWED_PAYMENT_STATES };
export default bookingService;
