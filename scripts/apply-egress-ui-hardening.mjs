import fs from 'node:fs';

const file = 'frontend/src/features/admin/pages/AdminDashboardPageV2.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is ambiguous: ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "  const [abandoned, setAbandoned] = useState([]);",
  "  const [abandoned, setAbandoned] = useState([]);\n  const [abandonedLoaded, setAbandonedLoaded] = useState(false);\n  const [abandonedLoading, setAbandonedLoading] = useState(false);",
  'abandoned lazy-load state'
);

replaceOnce(
`  const loadSummaryData = useCallback(async () => {
    if (!hasAuth()) return;
    const [statsRes, analyticsRes, abandonedRes] = await Promise.allSettled([
      withTimeout(adminAPI.getStats(), 12000, 'Dashboard stats'),
      withTimeout(adminAPI.getAnalytics(30), 12000, 'Analytics'),
      withTimeout(adminAPI.getAbandonedBookings(), 12000, 'Incomplete checkouts')
    ]);

    if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data || statsRes.value || null);
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value?.data || analyticsRes.value || null);
    if (abandonedRes.status === 'fulfilled') setAbandoned(abandonedRes.value?.data || abandonedRes.value || []);
  }, []);`,
`  const loadSummaryData = useCallback(async () => {
    if (!hasAuth()) return;
    const [statsRes, analyticsRes] = await Promise.allSettled([
      withTimeout(adminAPI.getStats(), 12000, 'Dashboard stats'),
      withTimeout(adminAPI.getAnalytics(30), 12000, 'Analytics')
    ]);

    if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data || statsRes.value || null);
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value?.data || analyticsRes.value || null);
  }, []);

  const loadAbandoned = useCallback(async ({ force = false } = {}) => {
    if (!hasAuth() || (abandonedLoaded && !force)) return;
    setAbandonedLoading(true);
    try {
      const response = await withTimeout(adminAPI.getAbandonedBookings(), 12000, 'Incomplete checkouts');
      setAbandoned(response?.data || response || []);
      setAbandonedLoaded(true);
    } catch (error) {
      setListError(errorMessage(error, 'Unable to load incomplete checkouts.'));
    } finally {
      setAbandonedLoading(false);
    }
  }, [abandonedLoaded]);`,
  'summary data / lazy abandoned loader'
);

replaceOnce(
  "  useEffect(() => { loadSummaryData(); }, [loadSummaryData]);",
  "  useEffect(() => { loadSummaryData(); }, [loadSummaryData]);\n\n  useEffect(() => {\n    if (activeTab === 'abandoned') loadAbandoned();\n  }, [activeTab, loadAbandoned]);",
  'lazy abandoned effect'
);

replaceOnce(
`  const refreshAll = async () => {
    await Promise.all([loadBookings(), loadSummaryData()]);
    if (selectedBooking?.id) await loadBookingDetail(selectedBooking.id);
  };`,
`  const refreshAll = async () => {
    const tasks = [loadBookings(), loadSummaryData()];
    if (activeTab === 'abandoned') tasks.push(loadAbandoned({ force: true }));
    await Promise.all(tasks);
    if (selectedBooking?.id) await loadBookingDetail(selectedBooking.id);
  };`,
  'refresh without unconditional abandoned fetch'
);

const oldStatuses = "['DRAFT','PENDING','AWAITING_AUTHORIZATION','AUTHORIZED','READY_FOR_TICKETING','TICKETED','COMPLETED','CANCELLED','FAILED']";
const newStatuses = "['DRAFT','PENDING','AWAITING_AUTHORIZATION','AUTHORIZED','READY_FOR_TICKETING','TICKETED','DONE','CANCELLED','FAILED']";
const statusMatches = source.split(oldStatuses).length - 1;
if (statusMatches !== 2) throw new Error(`Expected exactly 2 admin status option lists, found ${statusMatches}`);
source = source.split(oldStatuses).join(newStatuses);

replaceOnce(
  "onClick={() => setActiveTab('abandoned')}>Incomplete Forms ({abandoned.length})</button>",
  "onClick={() => setActiveTab('abandoned')}>Incomplete Forms{abandonedLoaded ? ` (${abandoned.length})` : ''}</button>",
  'abandoned tab count'
);

replaceOnce(
  '<div className="adv2-kpi"><div className="adv2-kpi__label">Incomplete forms</div><div className="adv2-kpi__value">{abandoned.length}</div><div className="adv2-kpi__sub">Saved checkout sessions</div></div>',
  '<div className="adv2-kpi"><div className="adv2-kpi__label">Incomplete forms</div><div className="adv2-kpi__value">{abandonedLoaded ? abandoned.length : \'—\'}</div><div className="adv2-kpi__sub">Loaded only when opened</div></div>',
  'abandoned KPI lazy state'
);

replaceOnce(
  '{abandoned.length === 0 ? <div className="adv2-empty">No incomplete checkout sessions.</div> : (',
  '{abandonedLoading ? <div className="adv2-loading">Loading incomplete checkout sessions…</div> : abandoned.length === 0 ? <div className="adv2-empty">No incomplete checkout sessions.</div> : (',
  'abandoned loading UI'
);

replaceOnce(
  "      await loadBookings();\n      await loadSummaryData();",
  "      await loadBookings();\n      await loadSummaryData();\n      if (activeTab === 'abandoned') await loadAbandoned({ force: true });",
  'delete refresh abandoned only when visible'
);

replaceOnce(
  "onImportComplete={() => { loadBookings(); loadSummaryData(); }}",
  "onImportComplete={() => { loadBookings(); loadSummaryData(); if (activeTab === 'abandoned') loadAbandoned({ force: true }); }}",
  'backup import conditional abandoned refresh'
);

fs.writeFileSync(file, source);
console.log('Applied lazy abandoned loading and canonical DONE status to AdminDashboardPageV2.js');
