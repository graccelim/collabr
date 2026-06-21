'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Target, Wallet, CircleCheck, Building2, Award, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import RatingChip from '@/components/RatingChip'
import { NICHE_LABELS, CREATOR_NICHES, type CreatorNiche } from '@/lib/onboarding'
import { chipColor } from '@/lib/niches'
import SaveCampaignButton from '@/components/SaveCampaignButton'
import ShareProfileButton from '@/components/ShareProfileButton'

export interface JobsListCampaign {
  id: string
  slug?: string | null
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
  /** Whether the signed-in creator has bookmarked this campaign. */
  saved?: boolean
  /** Remaining spots = creators_needed − funded collabs. Falls back to
   *  creators_needed when not provided. <= 0 renders as "Filled". */
  spots_left?: number | null
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


  // `campaigns` arrives already ranked best-first by the two-sided recommender
  // (rankCampaignsForCreator) - preserve that order, only apply the niche chip.
  const visible = useMemo(() => {
    if (filter === '__for_you') return campaigns
    return campaigns.filter(c => c.niche_tags?.includes(filter))
  }, [campaigns, filter])

  return (
    <>
      {/* Niche filter — a dropdown (scales past a handful of niches instead of a
          long chip row). Lists ALL niches; those with no live campaign are
          flagged so creators can see the full taxonomy. */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 12,
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 999,
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          maxWidth: '100%',
        }}
      >
        <SlidersHorizontal size={15} color="var(--brand)" style={{ flexShrink: 0 }} />
        <select
          aria-label="Filter campaigns by niche"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            border: 'none',
            background: 'transparent',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ink)',
            padding: '9px 34px 9px 2px',
            cursor: 'pointer',
            outline: 'none',
            maxWidth: '100%',
            textOverflow: 'ellipsis',
          }}
        >
          <option value="__for_you">For you</option>
          {CREATOR_NICHES.map(n => (
            <option key={n} value={n}>{nicheLabel(n)}</option>
          ))}
        </select>
        <ChevronDown
          size={15}
          color="var(--ink-faint-solid)"
          style={{ position: 'absolute', right: 12, pointerEvents: 'none' }}
        />
      </div>

      {/* Campaign cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visible.length === 0 && (
          <div className="card" style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>
            No campaigns match these filters. Try clearing a filter or check back soon.
          </div>
        )}
        {visible.map((c) => {
          const pays = paysLabel(c)
          const deliverable = c.deliverable_types?.[0] ?? '-'
          // Remaining spots (funded-aware) when provided; else the raw count.
          const left = c.spots_left ?? c.creators_needed
          const spotsText = left <= 0 ? 'Filled' : `${left} ${left === 1 ? 'spot' : 'spots'} left`
          return (
            <Link
              key={c.id}
              href={`/jobs/${c.slug || c.id}`}
              className="card hover-lift"
              style={{
                padding: 20,
                textDecoration: 'none',
                borderColor: c.is_featured ? 'var(--accent)' : 'var(--line)',
              }}
            >
              {/* Top zone */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', minWidth: 0 }}>{c.title}</div>
                      <span className="md:hidden" style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--ink-faint-solid)',
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}>{spotsText}</span>
                    </div>
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
                        {c.niche_tags.map(t => {
                          const cc = chipColor(t)
                          return (
                            <span key={t} style={{
                              fontSize: 11.5, fontWeight: 600, color: cc.fg,
                              background: cc.bg, padding: '3px 9px',
                              borderRadius: 'var(--radius-pill)',
                            }}>{nicheLabel(t)}</span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {/* Top-right cluster: honest fit tier (only when there's a
                    credible match - no numbers, ever) plus, on DESKTOP, the
                    save + share buttons inline with the campaign name. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {c.matchLabel && (
                    <span className={`badge ${matchClass(c.matchLabel)}`} style={{ flexShrink: 0, fontSize: 12 }}>
                      <span>{c.matchLabel}</span>
                    </span>
                  )}
                  <div className="hidden md:flex" style={{ alignItems: 'center', gap: 6 }}>
                    <SaveCampaignButton campaignId={c.id} initialSaved={Boolean(c.saved)} compact />
                    <ShareProfileButton path={`/jobs/${c.slug || c.id}`} name={c.title} noun="Campaign" compact />
                  </div>
                </div>
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
                  {/* Spots stays a meta column on desktop; on mobile it's the chip by the title. */}
                  <div className="hidden md:block">
                    <div className="eyebrow" style={{ fontSize: 10 }}>Spots</div>
                    <div style={{ fontSize: 14, fontWeight: 540, marginTop: 2, color: 'var(--ink)' }}>{spotsText}</div>
                  </div>
                </div>
                {/* On MOBILE this row goes full-width so save + share sit
                    space-between, to the right of the applied/selected badge.
                    On DESKTOP it's content-width (save + share live up by the
                    name), so only the badge/Apply shows here. */}
                <div className="w-full md:w-auto justify-between md:justify-end" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {c.appliedStatus && APPLIED[c.appliedStatus] ? (
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
                  {/* Mobile only - desktop shows these by the campaign name.
                      Display lives in the class (not inline) so `md:hidden`
                      can actually hide it on desktop. */}
                  <span className="flex md:hidden items-center" style={{ gap: 8 }}>
                    <SaveCampaignButton campaignId={c.id} initialSaved={Boolean(c.saved)} compact />
                    <ShareProfileButton path={`/jobs/${c.slug || c.id}`} name={c.title} noun="Campaign" compact />
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
