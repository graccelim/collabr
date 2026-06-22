'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Target, Wallet, CircleCheck, Building2, Award, SlidersHorizontal, X, Bookmark } from 'lucide-react'
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

// Filter option lists — mirrors the brand-side CreatorFilters taxonomy, but
// from the creator's point of view (browsing campaigns rather than creators).
const COMP_OPTS = [['', 'Any type'], ['paid', 'Paid'], ['barter', 'Barter']] as const
const PAY_OPTS = [['', 'Any pay'], ['100', 'S$100+'], ['250', 'S$250+'], ['500', 'S$500+'], ['1000', 'S$1,000+'], ['2500', 'S$2,500+']] as const
const SORT_OPTS = [['', 'For you'], ['pay', 'Highest pay'], ['deadline', 'Soonest deadline'], ['spots', 'Most spots']] as const

export default function JobsList({
  campaigns,
}: {
  campaigns: JobsListCampaign[]
}) {
  const [niche, setNiche] = useState('')
  const [comp, setComp] = useState('')
  const [minPay, setMinPay] = useState('')
  const [deliverable, setDeliverable] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [sort, setSort] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  // Only offer deliverable values that actually appear in the live set.
  const deliverableOpts = useMemo<ReadonlyArray<readonly [string, string]>>(() => {
    const set = new Set<string>()
    campaigns.forEach(c => c.deliverable_types?.forEach(d => set.add(d)))
    return [['', 'Any deliverable'], ...Array.from(set).sort().map(d => [d, d] as const)]
  }, [campaigns])

  const nicheOpts = useMemo<ReadonlyArray<readonly [string, string]>>(
    () => [['', 'Any niche'], ...CREATOR_NICHES.map(n => [n, nicheLabel(n)] as const)],
    [],
  )

  // `campaigns` arrives already ranked best-first by the two-sided recommender
  // (rankCampaignsForCreator). Filter in place; only re-sort when the creator
  // explicitly asks for a different order.
  const visible = useMemo(() => {
    const top = (c: JobsListCampaign) => c.budget_max ?? c.budget_min ?? 0
    let list = campaigns.filter(c => {
      if (niche && !c.niche_tags?.includes(niche)) return false
      if (comp === 'paid' && c.comp_type === 'barter') return false
      if (comp === 'barter' && c.comp_type === 'paid') return false
      if (minPay && !(c.comp_type !== 'barter' && top(c) >= Number(minPay))) return false
      if (deliverable && !c.deliverable_types?.includes(deliverable)) return false
      if (savedOnly && !c.saved) return false
      return true
    })
    if (sort === 'pay') list = [...list].sort((a, b) => top(b) - top(a))
    else if (sort === 'spots') list = [...list].sort((a, b) => (b.spots_left ?? b.creators_needed) - (a.spots_left ?? a.creators_needed))
    else if (sort === 'deadline') list = [...list].sort((a, b) => {
      const ad = a.deadline ? Date.parse(a.deadline) : Infinity
      const bd = b.deadline ? Date.parse(b.deadline) : Infinity
      return ad - bd
    })
    return list
  }, [campaigns, niche, comp, minPay, deliverable, savedOnly, sort])

  const activeCount = [niche, comp, minPay, deliverable].filter(Boolean).length + (savedOnly ? 1 : 0)
  const hasFilters = activeCount > 0
  function clearAll() {
    setNiche(''); setComp(''); setMinPay(''); setDeliverable(''); setSavedOnly(false); setSort('')
  }

  // Compact inline control (desktop bar) vs full-width control (mobile sheet).
  const select = (
    value: string, onChange: (v: string) => void,
    options: ReadonlyArray<readonly [string, string]>, ariaLabel: string, block = false,
  ) => (
    <select
      aria-label={ariaLabel}
      className="input"
      style={block
        ? { width: '100%', fontSize: 14, padding: '11px 34px 11px 12px' }
        : { width: 'auto', fontSize: 13, padding: '6px 32px 6px 11px' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  )

  // Dark-navy saved toggle — compact inline (desktop) / full-width (mobile top).
  // Always solid navy; the active state adds an inner ring + filled bookmark.
  const savedToggle = (full = false) => (
    <button
      type="button"
      onClick={() => setSavedOnly(s => !s)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)',
        borderRadius: full ? 'var(--radius)' : 999,
        border: '1px solid var(--brand)',
        background: 'var(--brand)',
        color: '#fff',
        boxShadow: savedOnly ? 'inset 0 0 0 2px rgba(255,255,255,.32)' : 'none',
        ...(full ? { width: '100%', height: 46, fontSize: 14 } : { fontSize: 13, padding: '7px 15px' }),
      }}
    >
      <Bookmark size={full ? 16 : 14} fill={savedOnly ? '#fff' : 'none'} />
      {full ? (savedOnly ? 'Showing saved — view all' : 'View saved campaigns') : 'Saved'}
    </button>
  )

  return (
    <>
      {/* Desktop: full inline filter bar (mirrors the brand Discover bar). */}
      <div className="cf-inline" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {select(niche, setNiche, nicheOpts, 'Filter by niche')}
        {select(comp, setComp, COMP_OPTS, 'Filter by compensation')}
        {select(minPay, setMinPay, PAY_OPTS, 'Filter by minimum pay')}
        {select(deliverable, setDeliverable, deliverableOpts, 'Filter by deliverable')}
        {savedToggle()}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFilters && (
            <button type="button" className="btn-ghost btn-sm" onClick={clearAll}>Clear</button>
          )}
          {select(sort, setSort, SORT_OPTS, 'Sort campaigns')}
        </div>
      </div>

      {/* Phones only: full-width navy "View saved" button above the filters. */}
      <div className="cf-saved-mobile" style={{ marginBottom: 10 }}>
        {savedToggle(true)}
      </div>

      {/* Phones: Filters button + sort control split the full width 50/50. */}
      <div className="cf-mobile" style={{ gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn-secondary" onClick={() => setSheetOpen(true)}
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13.5 }}>
          <SlidersHorizontal size={15} /> Filters{activeCount ? ` · ${activeCount}` : ''}
        </button>
        <div style={{ flex: 1 }}>{select(sort, setSort, SORT_OPTS, 'Sort campaigns', true)}</div>
      </div>

      {/* Mobile filter sheet — filters apply live. */}
      {sheetOpen && (
        <div onClick={() => setSheetOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,16,22,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface, #fff)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '16px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 30px rgba(14,16,22,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Filters</div>
              <button type="button" aria-label="Close filters" onClick={() => setSheetOpen(false)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-faint-solid)', display: 'grid', placeItems: 'center', width: 32, height: 32 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FilterField label="Niche">{select(niche, setNiche, nicheOpts, 'Filter by niche', true)}</FilterField>
              <FilterField label="Compensation">{select(comp, setComp, COMP_OPTS, 'Filter by compensation', true)}</FilterField>
              <FilterField label="Minimum pay">{select(minPay, setMinPay, PAY_OPTS, 'Filter by minimum pay', true)}</FilterField>
              <FilterField label="Deliverable">{select(deliverable, setDeliverable, deliverableOpts, 'Filter by deliverable', true)}</FilterField>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {hasFilters && (
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => { clearAll(); setSheetOpen(false) }}>
                  Clear all
                </button>
              )}
              <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSheetOpen(false)}>
                Show results
              </button>
            </div>
          </div>
        </div>
      )}

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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}
