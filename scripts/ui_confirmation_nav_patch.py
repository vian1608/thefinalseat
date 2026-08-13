from pathlib import Path

js_path = Path('frontend/src/features/bookings/pages/PaymentSuccessPage.js')
js = js_path.read_text()
anchor = '''      <div className="confirmation-container no-print-padding">\n        \n        {/* ── 1. Header Banner & Success Checkmark ──────────────────────── */}'''
replacement = '''      <div className="confirmation-container no-print-padding">\n        <div className="confirmation-context-nav no-print">\n          <Link to="/my-bookings" className="confirmation-context-back">\n            <i className="fas fa-arrow-left" aria-hidden="true"></i>\n            Back to My Bookings\n          </Link>\n        </div>\n\n        {/* ── 1. Header Banner & Success Checkmark ──────────────────────── */}'''
assert anchor in js, 'confirmation container anchor missing'
js = js.replace(anchor, replacement, 1)
js_path.write_text(js)

css_path = Path('frontend/src/features/bookings/pages/PaymentSuccessPage.css')
css = css_path.read_text()
anchor_css = '''.confirmation-container {\n  max-width: 960px;\n  margin: 0 auto;\n}\n'''
insert_css = '''.confirmation-container {\n  max-width: 960px;\n  margin: 0 auto;\n}\n\n.confirmation-context-nav {\n  display: flex;\n  align-items: center;\n  margin: 0 0 0.85rem;\n}\n\n.confirmation-context-back {\n  min-height: 40px;\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 12px;\n  border: 1px solid var(--tfs-border-strong, #c7d3e1);\n  border-radius: 10px;\n  background: #fff;\n  color: var(--tfs-text, #33445a);\n  font-size: .88rem;\n  font-weight: 750;\n  text-decoration: none;\n  box-shadow: var(--tfs-shadow-sm, 0 4px 16px rgba(11, 22, 40, .06));\n  transition: transform .18s ease, border-color .18s ease, color .18s ease, background .18s ease;\n}\n\n.confirmation-context-back i {\n  color: var(--tfs-wine-700, #861b3d);\n}\n\n.confirmation-context-back:hover {\n  transform: translateY(-1px);\n  border-color: rgba(134, 27, 61, .35);\n  color: var(--tfs-wine-800, #6d1532);\n  background: var(--tfs-wine-50, #fff7fa);\n}\n'''
assert anchor_css in css, 'confirmation CSS container anchor missing'
css = css.replace(anchor_css, insert_css, 1)
css_path.write_text(css)

print('Patched contextual confirmation navigation')
