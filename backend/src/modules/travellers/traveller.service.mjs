import travellerRepository from './traveller.repository.mjs';
import {
  validateDateOfBirth,
  validatePassportNumber,
  validatePassportExpiry
} from '../../shared/utils/validationHelpers.mjs';

export function calculateAge(dobString, departureDateString = '') {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  const refDate = departureDateString ? new Date(departureDateString) : new Date();
  let age = refDate.getFullYear() - dob.getFullYear();
  const m = refDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) age--;
  return age;
}

export const travellerService = {
  validateTravellers: (travellers, departureDate = '') => {
    const list = Array.isArray(travellers) ? travellers : [];
    if (list.length === 0) {
      throw new Error('At least one traveler is required for booking.');
    }

    for (let i = 0; i < list.length; i++) {
      const traveler = list[i];
      const name = `${traveler.firstName || ''} ${traveler.lastName || ''}`.trim() || `Passenger #${i + 1}`;

      if (!traveler.firstName || !traveler.firstName.trim()) {
        throw new Error(`First name is required for ${name}.`);
      }
      if (!traveler.lastName || !traveler.lastName.trim()) {
        throw new Error(`Last name is required for ${name}.`);
      }

      // Date of birth validation
      const dobCheck = validateDateOfBirth(traveler.dateOfBirth, traveler.role || 'adult', departureDate);
      if (!dobCheck.valid) {
        throw new Error(`${name}: ${dobCheck.message}`);
      }

      // Passport number validation (if present)
      if (traveler.passportNumber) {
        const passCheck = validatePassportNumber(traveler.passportNumber);
        if (!passCheck.valid) {
          throw new Error(`${name}: ${passCheck.message}`);
        }
      }

      // Passport expiry validation (if present)
      if (traveler.passportExpiry) {
        const expCheck = validatePassportExpiry(traveler.passportExpiry, departureDate);
        if (!expCheck.valid) {
          throw new Error(`${name}: ${expCheck.message}`);
        }
      }
    }
    return true;
  },

  getTravellersForBooking: async (bookingId) => {
    return travellerRepository.findTravellersByBookingId(bookingId);
  },

  saveTravellers: async (bookingId, travellersList) => {
    return travellerRepository.createTravellers(bookingId, travellersList);
  }
};

export default travellerService;
