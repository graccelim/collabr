'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Zap, Check, Sparkles, Bookmark, UserPlus, Search } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import { matchClass } from '@/components/JobsList'
import type { MatchResult, CreatorIndicators } from '@/lib/recommend'

interface Application {
  id: string
  pitch: string
  proposed_rate: number | null
  status: string
  is_boosted: boolean
  /** Present once the applicant has been selected → deep-link to funding. */
  collab_id?: string
  collab_payment_status?: string
  /** Honest creator↔campaign match (null when there's no credible fit to claim). */
  match?: MatchResult | null
  /** Boolean trust indicators (verified ownership, availability, etc). */
  indicators?: CreatorIndicators | null
  creator_profiles?: {
    id?: string
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
  spotsLeft?: number
}

const OWNERSHIP_NOTE = 'Account ownership verified — follower counts are self-reported'

export default function ApplicantList({ applications, campaignId, campaign, spotsLeft = 0 }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(applications.map(a => [a.id, a.status]))
  )
  const [filter, setFilter] = useState<'all' | 'saved' | 'passed'>('all')

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
        // Accept → fund is one motion: drop the brand straight onto the collab's
        // funding step so escrow gets secured (no stranded, unfunded collabs).
        if (data.collab_id) {
          toast.success('Creator accepted — fund escrow to start')
          router.push(`/collabs/${data.collab_id}`)
        } else {
          toast.success('Creator accepted — collab created')
          router.refresh()
        }
      } else if (status === 'shortlisted') {
        toast.success('Saved — only you can see this')
      } else {
        toast.success('Applicant passed')
      }
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  // Live triage buckets (reflect Save/Pass/Accept as they happen).
  const savedCount = applications.filter(a => statuses[a.id] === 'shortlisted').length
  const passedCount = applications.filter(a => statuses[a.id] === 'rejected').length
  const filtered = applications.filter(a => {
    const s = statuses[a.id]
    if (filter === 'saved') return s === 'shortlisted'
    if (filter === 'passed') return s === 'rejected'
    return s !== 'rejected' // "all" = everyone still in the running
  })
  const showTabs = savedCount > 0 || passedCount > 0
  const tabs: { key: 'all' | 'saved' | 'passed'; label: string; n: number }[] = [
    { key: 'all', label: 'In the running', n: applications.length - passedCount },
    { key: 'saved', label: 'Saved', n: savedCount },
    { key: 'passed', label: 'Passed', n: passedCount },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showTabs && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setFilter(t.key)}
              className={`chip${filter === t.key ? ' on' : ''}`}>
              {t.label}{t.n > 0 ? ` · ${t.n}` : ''}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 18, fontSize: 13.5, color: 'var(--ink-soft)' }}>
          {filter === 'saved'
            ? 'No saved applicants yet — tap Save on an applicant to compare your favourites here.'
            : filter === 'passed'
              ? 'No passed applicants.'
              : 'No active applicants right now.'}
        </div>
      ) : filtered.map(app => {
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
                    {creator?.id
                      ? <Link href={`/creators/${creator.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{name}</Link>
                      : <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{name}</span>}
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
                  {creator?.id && (
                    <Link href={`/creators/${creator.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)', marginTop: 5 }}>
                      View full profile →
                    </Link>
                  )}
                </div>
              </div>
              {matchLabel && (
                <span className={`badge ${matchClass(matchLabel)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
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
                  {status === 'shortlisted' && (
                    <span title="Private to you — the creator isn't notified"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)' }}>
                      <Bookmark size={13} fill="currentColor" /> Saved
                    </span>
                  )}
                  {status === 'pending' && (
                    <button
                      onClick={() => updateStatus(app.id, 'shortlisted')}
                      disabled={!!loading}
                      className="btn-secondary"
                      title="Save privately to compare later — the creator isn't notified"
                      style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Bookmark size={14} /> {loading === `${app.id}-shortlisted` ? '…' : 'Save'}
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
                app.collab_id ? (
                  ['unfunded', 'authorizing'].includes(app.collab_payment_status || 'unfunded') ? (
                    <Link href={`/collabs/${app.collab_id}`} className="btn-primary"
                      style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={14} /> Fund escrow{rateLabel ? ` ${rateLabel}` : ''} →
                    </Link>
                  ) : (
                    <Link href={`/collabs/${app.collab_id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--money-deep)' }}>
                      <Check size={15} /> Escrow secured · open collab →
                    </Link>
                  )
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--money-deep)' }}>
                    <Check size={15} /> Selected · collab created
                  </span>
                )
              )}
            </div>
          </div>
        )
      })}

      {/* Sparse state — keep the page productive: invite creators directly. */}
      {filter === 'all' && spotsLeft > 0 && (applications.length - passedCount) <= 2 && (
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-2)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: '#fff', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
            <UserPlus size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>Want more to choose from?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 }}>
              Don&rsquo;t wait on applications — invite creators that fit this campaign directly. New applicants also appear here automatically.
            </div>
          </div>
          <Link href="/creators" className="btn-primary" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Search size={15} /> Browse creators
          </Link>
        </div>
      )}
    </div>
  )
}

