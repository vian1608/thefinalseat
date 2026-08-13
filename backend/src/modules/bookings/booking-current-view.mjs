export function bookingCurrentView(record = {}) {
  if (!record || typeof record !== 'object') return record;
  return { ...record, currentVersion: Number(record.version || 1) };
}

export default bookingCurrentView;
