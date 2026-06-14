'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Zap, Check, Sparkles } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import type { MatchResult, CreatorIndicators } from '@/lib/recommend'

interface Application {
  id: string
  pitch: string
  proposed_rate: number | null
  status: string
  is_boosted: boolean
  /** Honest creator↔campaign match (null when there's no credible fit to claim). */
  match?: MatchResult | null
  /** Boolean trust indicators (verified ownership, availability, etc). */
  indicators?: CreatorIndicators | null
  creator_profiles?: {
    bio?: string | null
    niches?: string[] | null
    platforms?: Record<string, { handle: string; followers: number; verified: boolean }> | null
    base_rate?: number
    rating_avg?: number
    rating_count?: number
    is_verified?: boolean
    users?: { display_name?: string | null; avatar_url?: string | null }
  }
}

/** Campaign targeting passed in so we can compute a real creator↔campaign fit. */
interface CampaignFit {
  niche_tags?: string[] | null
  min_followers?: number | null
}

interface Props {
  applications: Application[]
  campaignId: string
  campaign?: CampaignFit
}

const OWNERSHIP_NOTE = 'Account ownership verified — follower counts are self-reported'

export default function ApplicantList({ applications, campaignId, campaign }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(applications.map(a => [a.id, a.status]))
  )

  async function updateStatus(appId: string, status: string) {
    setLoading(`${appId}-${status}`)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatuses(prev => ({ ...prev, [appId]: status }))
      if (status === 'selected') {
        toast.success('Creator selected — collab created!')
        router.refresh()
      } else {
        toast.success(`Application ${status}`)
      }
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {applications.map(app => {
        const creator = app.creator_profiles
        const name = creator?.users?.display_name || 'Creator'
        const status = statuses[app.id]
        const platforms = Object.values(creator?.platforms || {})
        const totalFollowers = platforms.reduce((sum, p) => sum + (p.followers || 0), 0)

        const match = app.match
        const indicators = app.indicators
        // Honest label only when computeMatch found a credible niche fit.
        const matchLabel = match?.label ?? null
        const reasons = match?.reasons ?? []
        // "Verified Account" reflects social OWNERSHIP only — never the stale
        // creator_profiles.is_verified flag.
        const verified = indicators?.verified ?? false
        const isNew = indicators?.isNew ?? false
        const showRating = indicators?.showRating ?? Boolean(creator?.rating_count)

        // Followers line: prefer real platform totals (self-reported), else niches.
        const sub = totalFollowers > 0
          ? `${totalFollowers.toLocaleString()} followers (self-reported)`
          : isNew
            ? 'New creator'
            : (creator?.niches && creator.niches.length > 0 ? creator.niches.join(' · ') : 'New creator')

        const rateLabel = app.proposed_rate != null ? formatSGD(app.proposed_rate) : null
        const isOpen = status === 'pending' || status === 'shortlisted'

        return (
          <div key={app.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 16,
                }}>{getInitials(name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{name}</span>
                    {verified && (
                      <span className="badge badge-money" title={OWNERSHIP_NOTE} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={11} /> Verified Account
                      </span>
                    )}
                    {isNew && status !== 'selected' && status !== 'rejected' && (
                      <span className="badge badge-neutral">New Creator</span>
                    )}
                    {app.is_boosted && (
                      <span className="badge badge-warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title="Sponsored placement — paid by the creator. It does not affect quality or trust signals.">
                        <Zap size={11} /> Boosted · Sponsored
                      </span>
                    )}
                    {status === 'selected' && <span className="badge badge-money">Selected</span>}
                    {status === 'rejected' && <span className="badge badge-neutral">Passed</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 1 }}>
                    {sub}
                    {showRating && creator?.rating_count ? ` · ${creator.rating_avg} ★ (${creator.rating_count})` : ''}
                  </div>
                </div>
              </div>
              {matchLabel && (
                <span className="badge badge-match" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <Sparkles size={11} /> {matchLabel}
                </span>
              )}
            </div>

            {reasons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {reasons.map(r => (
                  <span key={r} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 99,
                    background: 'var(--surface-2)', color: 'var(--ink-soft)',
                    fontSize: 12, fontWeight: 520,
                  }}>
                    <Check size={11} style={{ color: 'var(--money-deep)' }} /> {r}
                  </span>
                ))}
              </div>
            )}

            <p style={{ margin: '13px 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
              “{app.pitch}”
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>Their rate</span>
                <span className="mono-num" style={{ fontSize: 15, fontWeight: 560, color: 'var(--ink)' }}>
                  {rateLabel || '—'}
                </span>
              </div>

              {isOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {status === 'pending' && (
                    <button
                      onClick={() => updateStatus(app.id, 'shortlisted')}
                      disabled={!!loading}
                      className="btn-secondary"
                      style={{ height: 32, fontSize: 13, padding: '0 13px' }}
                    >
                      {loading === `${app.id}-shortlisted` ? '…' : 'Shortlist'}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(app.id, 'rejected')}
                    disabled={!!loading}
                    className="btn-ghost"
                    style={{ height: 32, fontSize: 13, padding: '0 10px', color: 'var(--ink-faint-solid)' }}
                  >
                    {loading === `${app.id}-rejected` ? '…' : 'Pass'}
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'selected')}
                    disabled={!!loading}
                    className="btn-primary"
                    style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Shield size={14} />
                    {loading === `${app.id}-selected` ? '…' : `Accept & fund${rateLabel ? ` ${rateLabel}` : ''}`}
                  </button>
                </div>
              )}

              {status === 'selected' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--money-deep)' }}>
                  <Check size={15} /> Selected · collab created
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
