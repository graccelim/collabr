import { mockAnalyticsEnabled } from '@/lib/dev/mock'
import { FlaskConical } from 'lucide-react'
import MockSeedControls from '@/components/MockSeedControls'

// Renders ONLY when mock analytics mode is on (dev). Makes it unmistakable that
// the analytics on screen are seeded demo data, not real performance, and offers
// one-click seed/reset so every Studio tab populates without the console.
export default function MockBanner() {
  if (!mockAnalyticsEnabled()) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 10,
      background: 'var(--warn-tint, #FBEFD6)', border: '1px solid rgba(178,106,30,.3)',
      fontSize: 12.5, color: 'var(--warn-deep, #8a531a)', fontWeight: 600, flexWrap: 'wrap',
    }}>
      <FlaskConical size={14} style={{ flex: 'none' }} />
      <span style={{ minWidth: 0 }}>Demo data — mock analytics mode is on. Seeded for testing, not real performance.</span>
      <MockSeedControls />
    </div>
  )
}
