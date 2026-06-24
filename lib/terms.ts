// Canonical plain-language definitions, reused across the app.
//
// Kept in a NON-client module: InfoTip is a client component, and a `'use client'`
// file turns every export (including plain constants) into a client reference.
// Server components import these strings during SSR, so they must live here to
// avoid "Could not find the module … in the React Client Manifest" crashes.
export const TERMS = {
  escrow: 'Payment is securely held until campaign requirements are completed.',
  barter: 'Products or services exchanged instead of cash payment.',
  collab: 'A collaboration between a brand and creator.',
} as const
