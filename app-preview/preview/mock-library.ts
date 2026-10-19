// Synthetic fixtures used only by vite.local-review.config.ts.
export async function loadLibraryLessons() {
  return [
    { id: 1, title: 'Coordinate cable tray before ceiling closure', pdf: { name: 'Example reference', link: '#example-reference' }, situation: 'Cable tray and ductwork conflicted above a finished ceiling.', rootCause: 'The coordination review did not include all trades.', impact: 'The ceiling had to be reopened.', recommendation: 'Proposed check: confirm cable tray clearances with the electrical lead before ceiling closure.', keywords: 'cable tray, coordination, clearance', discipline: 'Electrical' },
    { id: 2, title: 'Confirm delivery details before placing concrete', pdf: { name: 'Example reference', link: '#example-reference' }, situation: 'The scheduled concrete delivery arrived late.', rootCause: 'The delivery time had not been confirmed with the supplier.', impact: 'The pour was delayed.', recommendation: 'Confirm delivery time with the supplier before scheduling the crew.', keywords: 'concrete, delivery', discipline: 'Civil' },
  ];
}
