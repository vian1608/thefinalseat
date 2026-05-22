export const AIRLINE_ACTIONS = {
  book: {
    id: 'book',
    breadcrumbRoot: 'Book',
    breadcrumbDesk: 'Online Desk',
    h1: (name) => `Book ${name} Flights`,
    subtext:
      'Check real-time seating inventory and book your new flight with an agent today.',
    callLabel: 'Call Booking Support',
    formTitle: 'Secure Flight Inquiry',
    formIntro: 'Submit your route details. A logistics advisor will respond with options.',
    serviceType: 'flights',
  },
  changes: {
    id: 'changes',
    breadcrumbRoot: 'Changes',
    breadcrumbDesk: 'Support Desk',
    h1: (name) => `Call Now to Change Your ${name} Reservation`,
    subtext:
      'Modify travel dates, upgrade cabin seats, or change flight routes instantly.',
    callLabel: 'Call Change Support',
    formTitle: 'Reservation Change Inquiry',
    formIntro: 'Tell us what you need to change and our team will assist right away.',
    serviceType: 'flights',
  },
  cancellation: {
    id: 'cancellation',
    breadcrumbRoot: 'Cancellation',
    breadcrumbDesk: 'Quick Desk',
    h1: (name) => `Cancel ${name} Flight Bookings`,
    subtext:
      'Need to void a ticket or cancel your itinerary? Speak with an agent for immediate help.',
    callLabel: 'Call Cancellation Support',
    formTitle: 'Cancellation Assistance Inquiry',
    formIntro: 'Share your confirmation details for priority cancellation support.',
    serviceType: 'flights',
  },
};
