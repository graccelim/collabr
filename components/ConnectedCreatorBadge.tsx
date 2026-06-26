import { Star } from 'lucide-react'
import InfoTip from '@/components/InfoTip'
import { flags } from '@/lib/flags'

/**
 * ⭐ Connected Creator — premium analytics badge (Creator Pro). Renders only when
 * the creator is connected AND the flag is on. Shows "Last synced …"; when Pro
 * has lapsed the sync is frozen, so it shows a stale time + an explanatory tip
 * (badge stays visible by design — history is retained, not deleted).
 *
 * Not identity verification — copy says metrics are *synced from connected
 * accounts*, nothing more.
 */
function lastSyncedLabel(iso: string | null): string {
  if (!iso) return 'Syncing…'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Last synced today'
  if (days === 1) return 'Last synced 1 day ago'
  return `Last synced ${days} days ago`
}

export default function ConnectedCreatorBadge({
  connected,
  lastSyncedAt = null,
  frozen = false,
  showSync = true,
}: {
  connected: boolean
  lastSyncedAt?: string | null
  frozen?: boolean
  showSync?: boolean
}) {
  if (!connected || !flags.connectedCreator) return null
  const tip = frozen
    ? 'Analytics are no longer actively synced. Upgrade to Creator Pro to resume automatic updates. Historical analytics remain available.'
    : 'Performance metrics are synced from connected social accounts while Creator Pro is active.'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 999,
          background: 'var(--accent-tint)', color: 'var(--accent)',
          border: '1px solid rgba(0,4,53,0.14)', fontSize: 12, fontWeight: 700, lineHeight: 1,
        }}
      >
        <Star size={12} style={{ flexShrink: 0 }} /> Connected Creator
        <InfoTip text={tip} />
      </span>
      {showSync && (
        <span style={{ fontSize: 11.5, color: frozen ? 'var(--warn-deep)' : 'var(--ink-faint-solid)' }}>
          {lastSyncedLabel(lastSyncedAt)}
        </span>
      )}
    </span>
  )
}
