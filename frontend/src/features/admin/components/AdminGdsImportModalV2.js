import React from 'react';
import AdminItineraryImportModal from '../../../shared/components/admin/AdminItineraryImportModal';

const normalizeTripType = value => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'round-trip' || raw === 'round_trip') return 'round_trip';
  if (raw === 'multi-city' || raw === 'multi_city') return 'multi_city';
  return 'one_way';
};

const collectImportedSegments = importData => {
  if (!importData) return [];

  if (Array.isArray(importData.allSegments) && importData.allSegments.length > 0) {
    return importData.allSegments.map(segment => ({ ...segment }));
  }

  return [
    ...(importData.outboundSegments || []).map(segment => ({
      ...segment,
      journey_direction: 'outbound',
      direction: 'outbound'
    })),
    ...(importData.returnSegments || []).map(segment => ({
      ...segment,
      journey_direction: 'return',
      direction: 'return'
    })),
    ...(importData.multiCityJourneys || []).map(segment => ({
      ...segment,
      journey_direction: segment.journey_direction || 'multi_city',
      direction: segment.direction || segment.journey_direction || 'multi_city'
    }))
  ];
};

/**
 * Edit-booking GDS import deliberately reuses the exact importer used by
 * Create Booking. This keeps One Way / Round Trip / Multi-City parsing,
 * preview, help text and overwrite confirmation consistent across admin.
 *
 * AdminBookingManagementPanel owns the actual save so its existing
 * optimistic locking, refresh, audit messages and error handling stay intact.
 */
export default function AdminGdsImportModalV2({ isOpen, onClose, onApply }) {
  const handleConfirmImport = importData => {
    const segments = collectImportedSegments(importData);
    const payload = {
      segments,
      tripType: normalizeTripType(importData?.tripType),
      sourceText: null
    };

    // The shared Create Booking modal closes after confirmation. The parent
    // management panel already surfaces persistence failures in the Itinerary
    // section, so prevent a rejected async save from becoming an unhandled
    // browser promise while retaining that visible parent error state.
    Promise.resolve(onApply?.(payload)).catch(() => {});
  };

  return (
    <AdminItineraryImportModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirmImport={handleConfirmImport}
      existingItineraryHasData={true}
    />
  );
}
