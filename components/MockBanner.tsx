import { mockAnalyticsEnabled } from '@/lib/dev/mock'
import { FlaskConical } from 'lucide-react'

// Renders ONLY when mock analytics mode is on (dev). Makes it unmistakable that
// the analytics on screen are seeded demo data, not real performance.
export default function MockBanner() {
  if (!mockAnalyticsEnabled()) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10,
      background: 'var(--warn-tint, #FBEFD6)', border: '1px solid rgba(178,106,30,.3)',
      fontSize: 12.5, color: 'var(--warn-deep, #8a531a)', fontWeight: 600,
    }}>
      <FlaskConical size={14} />
      Demo data — mock analytics mode is on. These numbers are seeded for testing, not real performance.
    </div>
  )
}
