const clean = value => value === null || value === undefined ? '' : String(value).trim();

export function bookingCurrentView(record = {}) {
  if (!record || typeof record !== 'object') return record;
  const travellers = Array.isArray(record.travellers) ? record.travellers : (Array.isArray(record.passengers) ? record.passengers : []);
  const contacts = Array.isArray(record.contacts) ? record.contacts : [];
  const traveller = travellers[0] || null;
  const contact = contacts[0] || record.contact || null;
  const primaryName = traveller
    ? [traveller.first_name ?? traveller.firstName, traveller.middle_name ?? traveller.middleName, traveller.last_name ?? traveller.lastName].map(clean).filter(Boolean).join(' ')
    : clean(record.passenger_name || record.passengerName);
  const email = clean(contact?.email) || clean(record.email);
  const phone = clean(contact?.phone_number ?? contact?.phoneNumber ?? contact?.phone) || clean(record.phone);

  return {
    ...record,
    passenger_name: primaryName || record.passenger_name,
    passengerName: primaryName || record.passengerName,
    email,
    phone,
    contact: contact ? { ...contact, email, phone } : { email, phone },
    currentVersion: Number(record.version || 1)
  };
}

export default bookingCurrentView;
