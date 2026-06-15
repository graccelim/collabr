'use client'
import { Plus, X } from 'lucide-react'
import {
  SOCIAL_PLATFORMS, SOCIAL_LABELS, socialUrlPrefix,
  type SocialPlatform,
} from '@/lib/onboarding'
import { socialIcon } from '@/components/SocialIcon'

// One repeatable social-profile row. `username` is what the creator types — a
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
 * the parent owns the rows. Row order is meaningful — the first row is submitted
 * first and the API marks it primary. Prevents duplicate platforms.
 */
export default function SocialProfileBuilder({
  rows, onChange,
}: { rows: SocialRow[]; onChange: (rows: SocialRow[]) => void }) {
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
      <div className="space-y-3">
        {rows.map((row, i) => {
          const Icon = socialIcon(row.platform)
          const isXhs = row.platform === 'xiaohongshu'
          return (
            <div key={i} className="space-y-2" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
                  <Icon size={15} />
                </span>
                <select className="input" style={{ flex: 1, minWidth: 0 }} value={row.platform}
                  onChange={e => changePlatform(i, e.target.value as SocialPlatform)}>
                  {SOCIAL_PLATFORMS.map(p => (
                    <option key={p} value={p} disabled={p !== row.platform && used.has(p)}>
                      {SOCIAL_LABELS[p]}
                    </option>
                  ))}
                </select>
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

              {isXhs ? (
                // Xiaohongshu has no public username — take the profile link directly.
                <input className="input" inputMode="url" placeholder="Paste your RED (Xiaohongshu) profile link"
                  value={row.username} onChange={e => update(i, { username: e.target.value })} />
              ) : (
                // Fixed domain prefix + username — we complete the link for them.
                <div className="affix-field">
                  <span className="affix">{socialUrlPrefix(row.platform)}</span>
                  <input inputMode="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    placeholder="username"
                    value={row.username} onChange={e => update(i, { username: e.target.value })} />
                </div>
              )}

              <input className="input" type="number" min="0" placeholder="Follower count (optional)"
                value={row.followers}
                onChange={e => update(i, { followers: e.target.value })} />
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
