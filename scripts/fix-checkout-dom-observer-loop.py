from pathlib import Path

repo = Path('.')
checkout_path = repo / 'frontend/src/features/bookings/vouchers/BookingVoucherPage.js'
test_path = repo / 'backend/tests/voucher_system_contract.test.mjs'

checkout = checkout_path.read_text()
test = test_path.read_text()

old_mobile = """  const mobileTotal = document.querySelector('.mobile-summary-toggle-bar strong');
  if (mobileTotal) {
    const icon = mobileTotal.querySelector('i');
    const iconClass = icon?.className || '';
    setTextIfChanged(mobileTotal, finalText);
    if (iconClass) {
      const restoredIcon = document.createElement('i');
      restoredIcon.className = iconClass;
      mobileTotal.append(' ', restoredIcon);
    }
  }
"""
new_mobile = """  const mobileTotal = document.querySelector('.mobile-summary-toggle-bar strong');
  if (mobileTotal) {
    // Never rewrite this node when only whitespace/icon markup differs. The prior
    // implementation replaced the text and re-appended the icon on every observer
    // callback, which caused a self-triggering MutationObserver loop and froze Chrome.
    const currentText = String(mobileTotal.textContent || '').replace(/\\s+/g, ' ').trim();
    if (currentText !== finalText) {
      const icon = mobileTotal.querySelector('i')?.cloneNode(true) || null;
      mobileTotal.textContent = finalText;
      if (icon) mobileTotal.append(' ', icon);
    }
  }
"""
if old_mobile not in checkout:
    raise SystemExit('mobile total synchronization anchor not found')
checkout = checkout.replace(old_mobile, new_mobile, 1)

old_observer = """    syncCheckoutState();
    const observer = new MutationObserver(syncCheckoutState);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
"""
new_observer = """    let syncFrame = null;
    const scheduleSync = () => {
      if (syncFrame !== null) return;
      syncFrame = window.requestAnimationFrame(() => {
        syncFrame = null;
        syncCheckoutState();
      });
    };

    syncCheckoutState();
    const observer = new MutationObserver(scheduleSync);
    // Structural changes are enough for finding/reinstalling portal hosts. Watching
    // characterData caused our own price-label edits to recursively wake the observer.
    observer.observe(document.body, { childList: true, subtree: true });
"""
if old_observer not in checkout:
    raise SystemExit('observer anchor not found')
checkout = checkout.replace(old_observer, new_observer, 1)

old_resync = """    const resyncAfterInput = () => {
      window.requestAnimationFrame(syncCheckoutState);
    };
"""
new_resync = """    const resyncAfterInput = scheduleSync;
"""
if old_resync not in checkout:
    raise SystemExit('resync anchor not found')
checkout = checkout.replace(old_resync, new_resync, 1)

old_cleanup = """    return () => {
      observer.disconnect();
      document.removeEventListener('input', clearOnEmailChange, true);
"""
new_cleanup = """    return () => {
      observer.disconnect();
      if (syncFrame !== null) {
        window.cancelAnimationFrame(syncFrame);
        syncFrame = null;
      }
      document.removeEventListener('input', clearOnEmailChange, true);
"""
if old_cleanup not in checkout:
    raise SystemExit('cleanup anchor not found')
checkout = checkout.replace(old_cleanup, new_cleanup, 1)

regression_anchor = """assert.match(checkout, /60% of the ticket value/);\n"""
regression_insert = regression_anchor + """
// Checkout DOM synchronization must never observe and rewrite the same text in a
// tight loop. This protects against Chrome's Page Unresponsive failure on /booking/c_.
assert.match(checkout, /new MutationObserver\(scheduleSync\)/);
assert.match(checkout, /requestAnimationFrame/);
assert.doesNotMatch(checkout, /new MutationObserver\(syncCheckoutState\)/);
assert.doesNotMatch(checkout, /characterData:\s*true/);
assert.doesNotMatch(checkout, /setTextIfChanged\(mobileTotal,\s*finalText\)/);
"""
if 'Page Unresponsive failure on /booking/c_' not in test:
    if regression_anchor not in test:
        raise SystemExit('test anchor not found')
    test = test.replace(regression_anchor, regression_insert, 1)

checkout_path.write_text(checkout)
test_path.write_text(test)
