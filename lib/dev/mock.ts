// Developer-only mock analytics gate. Lets you test the full analytics UI +
// deterministic pipeline before live OAuth approvals. SAFETY:
//   • Off unless ANALYTICS_MOCK_MODE=true.
//   • NEVER on in production unless ALLOW_MOCK_IN_PROD=true is ALSO set (unsafe override).
//   • No real platform API calls happen in mock mode — data is generated locally
//     and run through the SAME deterministic engine as real syncs.
export function mockAnalyticsEnabled(): boolean {
  if (process.env.ANALYTICS_MOCK_MODE !== 'true') return false
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_IN_PROD !== 'true') return false
  return true
}
