'use client'
import { Plus, X, ShieldAlert } from 'lucide-react'
import {
  SOCIAL_PLATFORMS, SOCIAL_LABELS,
  type SocialPlatform,
} from '@/lib/onboarding'

// One repeatable social-profile row. `username` is what the creator types - a
// bare username for most platforms (we prepend the domain), or a pasted profile
// link for Xiaohongshu (which has no public username). extractHandle() normalizes
// either form to the canonical stored handle.
export interface SocialRow { platform: SocialPlatform; username: string; followers: string }

/** A fresh row pre-set to the first platform not already in `used`. */
export function newSocialRow(used: SocialPlatform[] = []): SocialRow {
  const set = new Set(used)
  const next = SOCIAL_PLATFORMS.find(p => !set.has(p)) ?? SOCIAL_PLATFORMS[0]
  return { platform: next, username: '', followers: '' }
}

/**
 * Repeatable social-profile builder shared by signup + onboarding. Controlled:
 * the parent owns the rows. Row order is meaningful - the first row is submitted
 * first and the API marks it primary. Prevents duplicate platforms.
 */
export default function SocialProfileBuilder({
  rows, onChange, showFollowers = true,
}: { rows: SocialRow[]; onChange: (rows: SocialRow[]) => void; showFollowers?: boolean }) {
  const used = new Set(rows.map(r => r.platform))
  const canAddMore = used.size < SOCIAL_PLATFORMS.length

  const update = (i: number, patch: Partial<SocialRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const changePlatform = (i: number, platform: SocialPlatform) => {
    if (!rows.some((r, idx) => idx !== i && r.platform === platform)) update(i, { platform })
  }
  const addRow = () => {
    const next = SOCIAL_PLATFORMS.find(p => !used.has(p))
    if (next) onChange([...rows, { platform: next, username: '', followers: '' }])
  }
  const removeRow = (i: number) => {
    if (rows.length > 1) onChange(rows.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      {/* Trust warning - impersonating accounts is grounds for removal. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        background: 'var(--warn-tint)', border: '1px solid rgba(217,119,6,.22)',
      }}>
        <ShieldAlert size={16} style={{ color: 'var(--warn-deep)', flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--warn-deep)' }}>
          Providing social accounts you do not own may result in account suspension and removal from the platform.
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => {
          return (
            <div key={i} className="space-y-2" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
              {/* platform + profile, side by side (follower count sits below) */}
              <div className="flex items-center gap-2">
                <select className="input" style={{ width: 'auto', flexShrink: 0, maxWidth: 150 }} value={row.platform}
                  onChange={e => changePlatform(i, e.target.value as SocialPlatform)}>
                  {SOCIAL_PLATFORMS.map(p => (
                    <option key={p} value={p} disabled={p !== row.platform && used.has(p)}>
                      {SOCIAL_LABELS[p]}
                    </option>
                  ))}
                </select>
                <input className="input" style={{ flex: 1, minWidth: 0 }}
                  inputMode="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="@handle"
                  value={row.username} onChange={e => update(i, { username: e.target.value })} />
                {i === 0 && (
                  <span className="badge badge-accent" style={{ fontSize: 10.5, flexShrink: 0 }}>Primary</span>
                )}
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} aria-label="Remove profile"
                    style={{ flexShrink: 0, border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8 }}>
                    <X size={16} />
                  </button>
                )}
              </div>

              {showFollowers && (
                <input className="input" type="number" min="0" placeholder="Follower count" required
                  value={row.followers}
                  onChange={e => update(i, { followers: e.target.value })} />
              )}
            </div>
          )
        })}
      </div>

      {canAddMore && (
        <button type="button" onClick={addRow}
          className="btn-secondary text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Add another platform
        </button>
      )}
    </div>
  )
}
