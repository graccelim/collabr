import { ShieldCheck, CheckCircle2, Repeat, Clock, Scale, Star } from 'lucide-react'

interface Props {
  completedCount: number
  completionRate: number | null         // 0..1
  responseTimeMedianHours: number | null
  disputesCount: number
  ratingAvg: number
  ratingCount: number
  repeatBrands: number
}

function responseLabel(h: number): string {
  if (h <= 1) return 'Responds within an hour'
  if (h <= 6) return 'Responds within 6 hours'
  if (h <= 24) return 'Responds within a day'
  return `Responds within ${Math.round(h / 24)} days`
}

/**
 * "Trust & reliability" — real platform reputation so brands can choose on
 * reliability, not follower counts. Each tile only renders with real data; a
 * creator with no history sees a clean placeholder, never a wall of zeros.
 */
export default function CreatorTrust(p: Props) {
  const hasHistory = p.completedCount > 0 || p.ratingCount > 0

  const tiles: { icon: typeof CheckCircle2; label: string; sub?: string }[] = []
  if (p.completedCount > 0) {
    tiles.push({ icon: CheckCircle2, label: `${p.completedCount} completed`, sub: 'collaborations' })
  }
  if (p.completedCount > 0 && p.completionRate != null) {
    tiles.push({ icon: ShieldCheck, label: `${Math.round(Number(p.completionRate) * 100)}% completion rate`, sub: 'finished what they started' })
  }
  if (p.ratingCount >= 1) {
    tiles.push({ icon: Star, label: `${Number(p.ratingAvg).toFixed(1)} average rating`, sub: `${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}` })
  }
  if (p.responseTimeMedianHours != null) {
    tiles.push({ icon: Clock, label: responseLabel(Number(p.responseTimeMedianHours)), sub: 'typical reply time' })
  }
  if (p.repeatBrands > 0) {
    tiles.push({ icon: Repeat, label: `${p.repeatBrands} repeat brand${p.repeatBrands === 1 ? '' : 's'}`, sub: 'came back for more' })
  }
  if (hasHistory) {
    tiles.push({ icon: Scale, label: `${p.disputesCount} dispute${p.disputesCount === 1 ? '' : 's'}`, sub: p.disputesCount === 0 ? 'clean record' : 'resolved' })
  }

  return (
    <section style={{ marginBottom: 30 }}>
      <h2 className="h2" style={{ fontSize: 18, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={17} color="var(--money-deep)" /> Trust &amp; reliability
      </h2>
      {!hasHistory ? (
        <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ShieldCheck size={17} color="var(--ink-faint-solid)" />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>No collaboration history yet</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 0', lineHeight: 1.5 }}>
              Reliability stats (completion rate, response time, repeat brands) appear here after their first collaboration.
            </p>
          </div>
        </div>
      ) : (
        <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {tiles.map((t, i) => (
            <div key={i} className="card" style={{ padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'center' }}>
              <t.icon size={18} color="var(--money-deep)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{t.label}</div>
                {t.sub && <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 1 }}>{t.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
