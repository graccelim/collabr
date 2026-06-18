'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Target, Wallet, CircleCheck, Building2, Award } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import RatingChip from '@/components/RatingChip'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'

export interface JobsListCampaign {
  id: string
  title: string
  comp_type: 'paid' | 'barter' | 'both'
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
  niche_tags: string[] | null
  deliverable_types: string[] | null
  min_followers: number
  creators_needed: number
  is_featured: boolean
  platform: string | null
  brand_name: string
  brand_logo: string | null
  brand_rating_avg: number | null
  brand_rating_count: number | null   // distinct collaborators
  /** The signed-in creator's application status for this campaign, if any. */
  appliedStatus: 'pending' | 'shortlisted' | 'selected' | 'rejected' | null
  /** Honest tier label ("Best Match" / "Strong Fit" / "Good Fit") or null. */
  matchLabel: string | null
  /** Creator-facing reasons ("Matches your niche", …) rendered as a ✓ list. */
  matchReasons: string[]
}

// Tier-specific colour for the fit label. Best Match gets the violet treatment;
// Strong Fit and Good Fit share the same indigo (visually unified per design).
export function matchClass(label: string | null): string {
  if (label === 'Best Match') return 'badge-match-best'
  return 'badge-match-strong' // Strong Fit + Good Fit + any default
}

// Colour-code each "why it fits" reason by what it means.
export function reasonStyle(reason: string): { bg: string; fg: string; Icon: typeof Check } {
  const r = reason.toLowerCase()
  if (r.includes('niche')) return { bg: 'rgba(249,115,22,.13)', fg: '#C2410C', Icon: Target }
  if (r.includes('rate') || r.includes('budget')) return { bg: 'var(--money-tint)', fg: 'var(--money-deep)', Icon: Wallet }
  if (r.includes('available')) return { bg: '#E6F4FB', fg: '#0E6F9E', Icon: CircleCheck }
  if (r.includes('brand')) return { bg: 'var(--warn-tint)', fg: 'var(--warn-deep)', Icon: Building2 }
  if (r.includes('complet') || r.includes('collaborat')) return { bg: 'var(--accent-tint)', fg: 'var(--accent-deep)', Icon: Award }
  return { bg: 'var(--paper-2)', fg: 'var(--ink-soft)', Icon: Check }
}

// How an existing application renders in place of the Apply affordance.
const APPLIED: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Applied',      cls: 'badge-neutral' },
  shortlisted: { label: 'Applied',      cls: 'badge-neutral' }, // private brand bookmark - looks like "Applied" to the creator
  selected:    { label: 'Selected',     cls: 'badge-money' },
  rejected:    { label: 'Not selected', cls: 'badge-neutral' },
}

function nicheLabel(tag: string): string {
  return NICHE_LABELS[tag as CreatorNiche] ?? tag
}

function paysLabel(c: JobsListCampaign): { value: string; money: boolean } {
  const hasPay = c.comp_type === 'paid' || c.comp_type === 'both'
  if (!hasPay) return { value: 'Barter', money: false }
  if (c.budget_min && c.budget_max) {
    return { value: `${formatSGD(c.budget_min)}–${formatSGD(c.budget_max)}`, money: true }
  }
  if (c.budget_min) return { value: formatSGD(c.budget_min), money: true }
  if (c.budget_max) return { value: formatSGD(c.budget_max), money: true }
  return { value: 'Paid', money: true }
}

function dueLabel(deadline: string | null): string {
  if (!deadline) return 'Flexible'
  return new Date(deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

export default function JobsList({
  campaigns,
}: {
  campaigns: JobsListCampaign[]
}) {
  const [filter, setFilter] = useState<string>('__for_you')

  // Build the niche filter chip row: "For you" + each distinct campaign niche.
  const niches = useMemo(() => {
    const set = new Set<string>()
    campaigns.forEach(c => c.niche_tags?.forEach(t => set.add(t)))
    return Array.from(set)
  }, [campaigns])

  // `campaigns` arrives already ranked best-first by the two-sided recommender
  // (rankCampaignsForCreator) - preserve that order, only apply the niche chip.
  const visible = useMemo(() => {
    if (filter === '__for_you') return campaigns
    return campaigns.filter(c => c.niche_tags?.includes(filter))
  }, [campaigns, filter])

  return (
    <>
      {/* Niche filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          className={`chip${filter === '__for_you' ? ' on' : ''}`}
          onClick={() => setFilter('__for_you')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <img src="/for-you.png" alt="" width={18} height={18} style={{ display: 'block', flexShrink: 0 }} />
          For you
        </button>
        {niches.map(n => (
          <button
            key={n}
            className={`chip${filter === n ? ' on' : ''}`}
            onClick={() => setFilter(n)}
          >
            {nicheLabel(n)}
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visible.map((c) => {
          const pays = paysLabel(c)
          const deliverable = c.deliverable_types?.[0] ?? '-'
          return (
            <Link
              key={c.id}
              href={`/jobs/${c.id}`}
              className="card hover-lift"
              style={{
                padding: 20,
                textDecoration: 'none',
                borderColor: c.is_featured ? 'var(--accent)' : 'var(--line)',
              }}
            >
              {/* Top zone */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                  {/* Brand avatar */}
                  <div style={{
                    width: 46, height: 46, borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(140deg, var(--accent-tint), color-mix(in srgb, var(--accent) 16%, #fff))',
                    boxShadow: 'inset 0 0 0 1px var(--line)',
                    display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                    fontSize: 14, fontWeight: 700, color: 'var(--accent-deep)',
                  }}>
                    {c.brand_logo
                      ? <img src={c.brand_logo} alt={c.brand_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitials(c.brand_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{c.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-faint-solid)', marginTop: 2 }}>
                      {c.brand_name}{c.platform ? ` · ${c.platform}` : ''}
                    </div>
                    {(c.brand_rating_count || 0) >= 1 && (
                      <div style={{ marginTop: 5 }}>
                        <RatingChip avg={c.brand_rating_avg} count={c.brand_rating_count} size={12} />
                      </div>
                    )}
                    {c.niche_tags && c.niche_tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {c.niche_tags.map(t => (
                          <span key={t} style={{
                            fontSize: 11.5, fontWeight: 500, color: 'var(--accent-deep)',
                            background: 'var(--accent-tint)', padding: '3px 9px',
                            borderRadius: 'var(--radius-pill)',
                          }}>{nicheLabel(t)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Honest fit tier - only shown when there's a credible match
                    to claim. No numbers, ever. Null → no pill. */}
                {c.matchLabel && (
                  <span className={`badge ${matchClass(c.matchLabel)}`} style={{ flexShrink: 0, fontSize: 12 }}>
                    <span>{c.matchLabel}</span>
                  </span>
                )}
              </div>

              {/* Why it fits - compact ✓ list of honest, categorical reasons. */}
              {c.matchReasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                  {c.matchReasons.map(reason => {
                    const rs = reasonStyle(reason)
                    return (
                      <span key={reason} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, color: rs.fg, fontWeight: 500,
                        background: rs.bg, padding: '4px 10px', borderRadius: 99,
                      }}>
                        <rs.Icon size={12} style={{ flexShrink: 0 }} />
                        {reason}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Bottom zone */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
                marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                  {[
                    { k: 'Pays', v: pays.value, money: pays.money },
                    { k: 'Deliverable', v: deliverable, money: false },
                    { k: 'Due', v: dueLabel(c.deadline), money: false },
                    { k: 'Spots', v: `${c.creators_needed} open`, money: false },
                  ].map(({ k, v, money }) => (
                    <div key={k}>
                      <div className="eyebrow" style={{ fontSize: 10 }}>{k}</div>
                      <div
                        className={money ? 'mono-num' : undefined}
                        style={{
                          fontSize: 14, fontWeight: 540, marginTop: 2,
                          color: money ? 'var(--money-deep)' : 'var(--ink)',
                        }}
                      >{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {c.appliedStatus ? (
                    <span className={`badge ${APPLIED[c.appliedStatus].cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.appliedStatus === 'selected' && <Check size={12} />}
                      {APPLIED[c.appliedStatus].label}
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 540, color: 'var(--accent-deep)',
                    }}>
                      Apply <ArrowRight size={15} />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
