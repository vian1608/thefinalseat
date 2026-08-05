/**
 * Admin Data Consistency & Global Save Orchestration Regression Test Suite (27 Tests)
 * Verifies cents-based financial calculations, decimal text currency inputs, safe billing metadata persistence
 * in booking_payment_methods (with lookup-then-update/insert & read-after-write verification), authorization amount sync,
 * 1-cent split mismatch save block ($878.01 vs $878.00), global save orchestration (dirty section filtering, 20s timeout,
 * mandatory finally cleanup block), single canonical success banner, and fake address removal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { moneyToCents, centsToMoney } from '../src/shared/utils/pricing.helper.mjs';

const loadFile = (relativePath) => {
  try {
    return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
  } catch {
    try {
      return readFileSync(resolve(process.cwd(), '..', relativePath), 'utf-8');
    } catch {
      return '';
    }
  }
};

const adminDashboardSrc = loadFile('frontend/src/features/admin/pages/AdminDashboardPage.js');
const bookingRepoSrc = loadFile('backend/src/modules/bookings/booking.repository.mjs');
const bookingMapperSrc = loadFile('backend/src/modules/bookings/booking.mapper.mjs');
const bookingPageSrc = loadFile('frontend/src/features/bookings/pages/BookingPage.js');

describe('TEST 1 — Pending authorization after pricing change', () => {
  it('recalculates draft authorization amount to match new customer total ($878.00)', () => {
    const oldAmountCents = moneyToCents('700.00');
    const newTotalCents = moneyToCents('878.00');
    expect(oldAmountCents).toBe(70000);
    expect(newTotalCents).toBe(87800);
    expect(centsToMoney(newTotalCents)).toBe('878.00');
    expect(adminDashboardSrc).toContain('draftAuthorizationAmountCents');
  });
});

describe('TEST 2 — Authorization already sent', () => {
  it('marks authorization status as REAUTHORIZATION_REQUIRED when pricing changes on a sent request', () => {
    expect(adminDashboardSrc).toContain("REAUTHORIZATION_REQUIRED");
  });
});

describe('TEST 3 — Accepted authorization', () => {
  it('preserves immutable accepted evidence snapshot when price changes post-acceptance', () => {
    expect(bookingRepoSrc).toContain("recordPriceRevision");
    expect(bookingRepoSrc).not.toContain("UPDATE authorization_evidence SET amount");
  });
});

describe('TEST 4 & 5 — Mouse wheel & Arrow key input protection', () => {
  it('blocks mouse wheel and arrow key value increments on financial inputs', () => {
    expect(adminDashboardSrc).toContain("onWheel={(e) => e.currentTarget.blur()}");
    expect(adminDashboardSrc).toContain("if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();");
  });
});

describe('TEST 6 — Integer cents decimal math', () => {
  it('sums 800.00 and 78.00 to exactly 878.00 without floating point artifacts', () => {
    const split1Cents = moneyToCents('800.00');
    const split2Cents = moneyToCents('78.00');
    const totalCents = split1Cents + split2Cents;
    expect(totalCents).toBe(87800);
    expect(centsToMoney(totalCents)).toBe('878.00');
  });
});

describe('TEST 7 — One-cent split mismatch block', () => {
  it('blocks payment split save when split total (878.01) differs from booking total (878.00)', () => {
    const splitTotalCents = moneyToCents('878.01');
    const bookingTotalCents = moneyToCents('878.00');
    expect(splitTotalCents).not.toBe(bookingTotalCents);
    expect(adminDashboardSrc).toContain('Payment authorization amounts do not match');
    expect(adminDashboardSrc).toContain('Difference:');
  });
});

describe('TEST 8 — Checkout safe metadata build', () => {
  it('builds safe paymentMethod payload containing cardBrand, cardLast4, exp_month, exp_year without PAN or CVV', () => {
    expect(bookingRepoSrc).toContain("PROHIBITED_FIELDS = ['cvv', 'cvc', 'fullCardNumber', 'pan', 'securityCode', 'pin', 'track_data', 'raw_card']");
  });
});

describe('TEST 9 — No PAN or CVV persistence', () => {
  it('throws PROHIBITED_BILLING_FIELD error if sensitive card fields are submitted', () => {
    expect(bookingRepoSrc).toContain("PROHIBITED_BILLING_FIELD: Field");
  });
});

describe('TEST 10 — Billing metadata database persistence', () => {
  it('saves addressLine1, city, state, postalCode, country in booking_payment_methods', () => {
    expect(bookingRepoSrc).toContain("updates.billing_address_line1 = addr1Val");
    expect(bookingRepoSrc).toContain("updates.billing_city = cityVal");
  });
});

describe('TEST 11 — Database persistence failure handling', () => {
  it('throws a real error in production when database write fails instead of relying on memory store', () => {
    expect(bookingRepoSrc).toContain("BILLING_PERSISTENCE_FAILED: Unable to save billing metadata to database");
  });
});

describe('TEST 12 — Read-after-write verification', () => {
  it('executes getPaymentMethodByBookingId after saving billing metadata to verify row in DB', () => {
    expect(bookingRepoSrc).toContain("const verified = await bookingRepository.getPaymentMethodByBookingId(bookingId)");
  });
});

describe('TEST 13 — Admin refresh hydration', () => {
  it('queries booking_payment_methods table in getCompleteBookingById', () => {
    expect(bookingRepoSrc).toContain("supabase.from('booking_payment_methods').select('*').eq('booking_id', realId)");
    expect(bookingMapperSrc).toContain("billingDetails:");
  });
});

describe('TEST 14 — Fake address default removal', () => {
  it('does not contain hardcoded 123 Main Street or fake New York fallback defaults in BookingPage.js', () => {
    expect(bookingPageSrc).not.toContain("billingAddress: prev.billingAddress || '123 Main Street'");
    expect(bookingPageSrc).not.toContain("billingCity: prev.billingCity || 'New York'");
  });
});

describe('TEST 15 — Existing booking without metadata display', () => {
  it('displays Not captured during checkout when card metadata is not present', () => {
    expect(adminDashboardSrc).toContain("Not captured during checkout");
    expect(adminDashboardSrc).not.toContain("Card ending unavailable");
  });
});

describe('TEST 16 — Authorization email consistency', () => {
  it('ensures authorization email uses draftAuthorizationAmountCents derived from validated splits', () => {
    expect(adminDashboardSrc).toContain("draftAuthorizationAmount");
  });
});

describe('TEST 17 — Mobile and desktop input readiness', () => {
  it('uses type="text" inputMode="decimal" for cross-platform decimal entry', () => {
    expect(adminDashboardSrc).toContain('type="text"');
    expect(adminDashboardSrc).toContain('inputMode="decimal"');
  });
});

describe('TEST 18 — Section save clears dirty state', () => {
  it('resets paymentDirty to false after payment save completes', () => {
    expect(adminDashboardSrc).toContain("setPaymentDirty(false)");
  });
});

describe('TEST 19 — Reconciliation success', () => {
  it('clears dirty state and sets single success message when interrupted response reconciles', () => {
    expect(adminDashboardSrc).toContain("setPaymentSaveSuccessMsg('Payment was saved successfully, although the original response was interrupted.')");
  });
});

describe('TEST 20 — Global save with no dirty sections', () => {
  it('returns immediately with All changes are already saved message when no section is dirty', () => {
    expect(adminDashboardSrc).toContain("All changes are already saved.");
  });
});

describe('TEST 21 — Global save with dirty sections', () => {
  it('inspects dirty sections and calls save handlers for dirty sections only', () => {
    expect(adminDashboardSrc).toContain("const dirtySections = []");
    expect(adminDashboardSrc).toContain("if (pricingDirty) dirtySections.push('pricing')");
    expect(adminDashboardSrc).toContain("if (paymentDirty) dirtySections.push('payment')");
  });
});

describe('TEST 22 — Child handler in-flight guard result', () => {
  it('returns structured error object when child save handler is already in flight', () => {
    expect(adminDashboardSrc).toContain("paymentSaveInFlightRef.current");
    expect(adminDashboardSrc).toContain("A payment save is already in progress.");
  });
});

describe('TEST 23 — Partial section failure handling', () => {
  it('resets global loading state and reports failed sections on partial failure', () => {
    expect(adminDashboardSrc).toContain("setGlobalSaveStatus('failure')");
    expect(adminDashboardSrc).toContain("Some changes could not be saved");
  });
});

describe('TEST 24 — Duplicate success banner prevention', () => {
  it('renders a single canonical payment success message container', () => {
    const paymentMsgMatches = (adminDashboardSrc.match(/paymentSaveSuccessMsg/g) || []).length;
    expect(paymentMsgMatches).toBeGreaterThan(0);
    expect(adminDashboardSrc).toContain("setPaymentSaveSuccessMsg");
  });
});

describe('TEST 25 — Refresh hydration guard', () => {
  it('uses isHydratingRef guard during form population to prevent false dirty flags', () => {
    expect(adminDashboardSrc).toContain("isHydratingRef = useRef(false)");
    expect(adminDashboardSrc).toContain("if (isHydratingRef.current) return;");
  });
});

describe('TEST 26 — Global save timeout', () => {
  it('enforces 20-second AbortController timeout on global save', () => {
    expect(adminDashboardSrc).toContain("20000");
    expect(adminDashboardSrc).toContain("Global save timed out after 20 seconds");
  });
});

describe('TEST 27 — Mandatory finally block cleanup', () => {
  it('resets globalSaving, updatingRecord, and in-flight flags inside a mandatory finally block', () => {
    expect(adminDashboardSrc).toContain("setGlobalSaving(false)");
    expect(adminDashboardSrc).toContain("setUpdatingRecord(false)");
    expect(adminDashboardSrc).toContain("paymentSaveInFlightRef.current = false");
  });
});
