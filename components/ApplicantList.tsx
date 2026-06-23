'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Zap, Check, Bookmark, UserPlus, Search, ExternalLink } from 'lucide-react'
import { formatSGD } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { matchClass, reasonStyle } from '@/components/JobsList'
import { socialIcon } from '@/components/SocialIcon'
import { SOCIAL_LABELS, socialHandleLabel, type SocialPlatform } from '@/lib/onboarding'
import { isPaymentSecured } from '@/lib/collab-status'
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
  /** 0 = barter collab (no payment). */
  collab_agreed_rate?: number
  /** Honest creator↔campaign match (null when there's no credible fit to claim). */
  match?: MatchResult | null
  /** Boolean trust indicators (availability, completed collabs, etc). */
  indicators?: CreatorIndicators | null
  /** Creator-provided social profiles - clickable so the brand can verify them. */
  socials?: { platform: string; handle: string; url: string }[]
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

export default function ApplicantList({ applications, campaignId, campaign, spotsLeft = 0 }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(applications.map(a => [a.id, a.status]))
  )
  const [filter, setFilter] = useState<'all' | 'saved' | 'selected' | 'passed'>('all')

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
          toast.success('Creator accepted')
          // ?fund=1 auto-opens the payment modal on the collab page so Accept →
          // pay is one continuous motion (barter collabs ignore the flag).
          router.push(`/collabs/${data.collab_id}?fund=1`)
        } else {
          toast.success('Creator accepted, collab created')
          router.refresh()
        }
      } else if (status === 'shortlisted') {
        toast.success('Shortlisted, only you can see this')
      } else if (status === 'pending') {
        toast.success('Removed from shortlist')
      } else {
        toast.success('Applicant passed')
      }
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  // Undo a selection before funding: cancels the hidden collab and returns the
  // applicant to "pending" (Applied). Only offered while unfunded.
  async function undoSelection(appId: string, collabId: string) {
    setLoading(`${appId}-undo`)
    try {
      const res = await fetch(`/api/collabs/${collabId}/unselect`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatuses(prev => ({ ...prev, [appId]: 'pending' }))
      toast.success('Selection undone, applicant is back in Applied')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not undo the selection')
    } finally {
      setLoading(null)
    }
  }

  // Live triage buckets (reflect Shortlist/Pass/Accept as they happen).
  const shortlistedCount = applications.filter(a => statuses[a.id] === 'shortlisted').length
  const rejectedCount = applications.filter(a => statuses[a.id] === 'rejected').length
  const selectedCount = applications.filter(a => statuses[a.id] === 'selected').length
  const appliedCount = applications.filter(a => statuses[a.id] === 'pending').length
  const filtered = applications.filter(a => {
    const s = statuses[a.id]
    if (filter === 'saved') return s === 'shortlisted'
    if (filter === 'selected') return s === 'selected'
    if (filter === 'passed') return s === 'rejected'
    return s === 'pending' // "Applied" tab
  })
  const showTabs = applications.length > 0
  const tabs: { key: 'all' | 'saved' | 'selected' | 'passed'; label: string; n: number }[] = [
    { key: 'all', label: 'Applied', n: appliedCount },
    { key: 'saved', label: 'Shortlisted', n: shortlistedCount },
    { key: 'selected', label: 'Selected', n: selectedCount },
    { key: 'passed', label: 'Rejected', n: rejectedCount },
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
            ? 'No shortlisted applicants yet, tap Shortlist on an applicant to compare your favourites here.'
            : filter === 'selected'
              ? 'No selected creators yet. Accept an applicant to start a collab.'
              : filter === 'passed'
                ? 'No declined applicants.'
                : 'No new applicants right now.'}
        </div>
      ) : filtered.map(app => {
        const creator = app.creator_profiles
        const name = creator?.users?.display_name || 'Creator'
        const avatar = creator?.users?.avatar_url
        // Open the profile on its own page, but carry where we came from so the
        // back button returns to this campaign (not Discover).
        const profileHref = creator?.id ? `/creators/${creator.id}?from=/campaigns/${campaignId}` : null
        const status = statuses[app.id]
        const platforms = Object.values(creator?.platforms || {})
        const totalFollowers = platforms.reduce((sum, p) => sum + (p.followers || 0), 0)

        const match = app.match
        const indicators = app.indicators
        // Honest label only when computeMatch found a credible niche fit.
        const matchLabel = match?.label ?? null
        const reasons = match?.reasons ?? []
        const socials = app.socials ?? []
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
          <div key={app.id} className="card card-hover" style={{ padding: 18, cursor: profileHref ? 'pointer' : 'default' }}
            onClick={() => { if (profileHref) router.push(profileHref) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
                <Avatar src={avatar} name={name} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{name}</span>
                    {isNew && status !== 'selected' && status !== 'rejected' && (
                      <span className="badge badge-neutral">New Creator</span>
                    )}
                    {app.is_boosted && (
                      <span className="badge badge-warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title="Sponsored placement, paid by the creator. It does not affect quality or trust signals.">
                        <Zap size={11} /> Boosted · Sponsored
                      </span>
                    )}
                    {status === 'selected' && (
                      isPaymentSecured(app.collab_payment_status)
                        ? <span className="badge badge-money">{app.collab_agreed_rate === 0 ? 'Confirmed' : 'Confirmed · Payment Secured'}</span>
                        : <span className="badge badge-amber">Selected · awaiting payment</span>
                    )}
                    {status === 'rejected' && <span className="badge badge-neutral">Rejected</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 1 }}>
                    {sub}
                    {showRating && creator?.rating_count ? ` · ${creator.rating_avg} ★ (${creator.rating_count})` : ''}
                  </div>
                  {/* Creator-provided socials - one click to check each account */}
                  {socials.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {socials.map(s => {
                        const Icon = socialIcon(s.platform)
                        return (
                          <a key={s.platform + s.handle} href={s.url} target="_blank" rel="noopener noreferrer"
                            title={`${SOCIAL_LABELS[s.platform as SocialPlatform] || s.platform}, opens in a new tab`}
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
                              borderRadius: 99, border: '1px solid var(--line)', background: 'var(--surface)',
                              fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none',
                            }}>
                            <Icon size={12} style={{ flexShrink: 0 }} />
                            {socialHandleLabel(s.platform as SocialPlatform, s.handle)}
                            <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                          </a>
                        )
                      })}
                    </div>
                  )}
                  {profileHref && (
                    <Link href={profileHref} onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)', marginTop: 8 }}>
                      View full profile →
                    </Link>
                  )}
                </div>
              </div>
              {matchLabel && (
                <span className={`badge ${matchClass(matchLabel)}`} style={{ flexShrink: 0 }}>
                  <span>{matchLabel}</span>
                </span>
              )}
            </div>

            {reasons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {reasons.map(r => {
                  const rs = reasonStyle(r)
                  return (
                    <span key={r} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 99,
                      background: rs.bg, color: rs.fg,
                      fontSize: 12, fontWeight: 520,
                    }}>
                      <rs.Icon size={11} style={{ flexShrink: 0 }} /> {r}
                    </span>
                  )
                })}
              </div>
            )}

            <p style={{ margin: '13px 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
              “{app.pitch}”
            </p>

            <div onClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>Their rate</span>
                <span className="mono-num" style={{ fontSize: 15, fontWeight: 560, color: 'var(--ink)' }}>
                  {rateLabel || '-'}
                </span>
              </div>

              {isOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {status === 'shortlisted' && (
                    <button
                      onClick={() => updateStatus(app.id, 'pending')}
                      disabled={!!loading}
                      className="btn-ghost"
                      title="Remove from your private shortlist, the creator isn't notified"
                      style={{ height: 32, fontSize: 13, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-faint-solid)' }}
                    >
                      <Bookmark size={13} fill="currentColor" /> {loading === `${app.id}-pending` ? '…' : 'Remove from shortlist'}
                    </button>
                  )}
                  {status === 'pending' && (
                    <button
                      onClick={() => updateStatus(app.id, 'shortlisted')}
                      disabled={!!loading}
                      className="btn-secondary"
                      title="Shortlist privately to compare later, the creator isn't notified"
                      style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Bookmark size={14} /> {loading === `${app.id}-shortlisted` ? '…' : 'Shortlist'}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(app.id, 'rejected')}
                    disabled={!!loading}
                    className="btn-ghost"
                    style={{ height: 32, fontSize: 13, padding: '0 10px', color: 'var(--ink-faint-solid)' }}
                  >
                    {loading === `${app.id}-rejected` ? '…' : 'Decline'}
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'selected')}
                    disabled={!!loading}
                    className="btn-primary"
                    style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Shield size={14} />
                    {loading === `${app.id}-selected` ? '…' : rateLabel ? `Accept & fund ${rateLabel}` : 'Accept'}
                  </button>
                </div>
              )}

              {status === 'selected' && (
                app.collab_id ? (
                  ['unfunded', 'authorizing'].includes(app.collab_payment_status || 'unfunded') ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Before funding the brand can still back out. */}
                      <button
                        onClick={() => undoSelection(app.id, app.collab_id!)}
                        disabled={!!loading}
                        className="btn-ghost"
                        title="Return this applicant to the pool, they were never notified"
                        style={{ height: 32, fontSize: 13, padding: '0 11px', color: 'var(--ink-faint-solid)' }}
                      >
                        {loading === `${app.id}-undo` ? '…' : 'Undo selection'}
                      </button>
                      <Link href={`/collabs/${app.collab_id}?fund=1`} className="btn-primary"
                        style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} /> Secure payment{rateLabel ? ` ${rateLabel}` : ''} →
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Link href={`/collabs/${app.collab_id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--money-deep)' }}>
                        <Check size={15} /> {app.collab_agreed_rate === 0 ? 'Confirmed · open collab →' : 'Confirmed · Payment Secured · open collab →'}
                      </Link>
                      {/* Funded: undo is gone — escrow changes go through support. */}
                      <a href="mailto:joincollabr@gmail.com" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>
                        Contact support
                      </a>
                    </div>
                  )
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--warn-deep)' }}>
                    <Check size={15} /> Selected · awaiting payment
                  </span>
                )
              )}
            </div>
          </div>
        )
      })}

      {/* Sparse state - keep the page productive: invite creators directly. */}
      {filter === 'all' && spotsLeft > 0 && appliedCount <= 2 && (
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-2)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: '#fff', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
            <UserPlus size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>Want more to choose from?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 }}>
              Don&rsquo;t wait on applications, invite creators that fit this campaign directly. New applicants also appear here automatically.
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

