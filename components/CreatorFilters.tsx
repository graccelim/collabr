'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { CREATOR_NICHES, SOCIAL_PLATFORMS, NICHE_LABELS } from '@/lib/onboarding'
import { AVAILABILITY_STATUSES, AVAILABILITY_LABELS } from '@/lib/profiles'

const SORTS = [
  ['', 'Most relevant'],
  ['rating', 'Highest rated'],
  ['collabs', 'Most completed collabs'],
  ['rate_low', 'Lowest rate'],
  ['rate_high', 'Highest rate'],
  ['newest', 'Newest'],
] as const

const FOLLOWER_TIERS = [
  ['', 'Any followers'],
  ['1000', '1k+'],
  ['5000', '5k+'],
  ['10000', '10k+'],
  ['50000', '50k+'],
  ['100000', '100k+'],
] as const

const RATE_CAPS = [
  ['', 'Any rate'],
  ['100', 'Up to S$100'],
  ['250', 'Up to S$250'],
  ['500', 'Up to S$500'],
  ['1000', 'Up to S$1,000'],
  ['2500', 'Up to S$2,500'],
] as const

const FILTER_KEYS = ['platform', 'niche', 'followers', 'availability', 'maxRate', 'location', 'saved']

export default function CreatorFilters({ showSaved }: { showSaved: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page') // any filter change resets pagination
    router.push(`/creators?${next.toString()}`)
  }

  const hasFilters = FILTER_KEYS.some(k => params.get(k))
  const activeCount = FILTER_KEYS.filter(k => params.get(k)).length

  // `block` → full-width control (used inside the mobile sheet); otherwise the
  // compact inline control used in the desktop bar.
  const select = (key: string, options: ReadonlyArray<readonly [string, string]>, block = false) => (
    <select
      className="input"
      style={block
        ? { width: '100%', fontSize: 14, padding: '11px 34px 11px 12px' }
        : { width: 'auto', fontSize: 13, padding: '6px 32px 6px 11px' }}
      value={params.get(key) || ''}
      onChange={e => setParam(key, e.target.value)}
    >
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )

  const locationInput = (block = false) => (
    <input
      className="input"
      style={block ? { width: '100%', fontSize: 14, padding: '11px 12px' } : { width: 140, fontSize: 13, padding: '6px 10px' }}
      placeholder="Location"
      defaultValue={params.get('location') || ''}
      onKeyDown={e => { if (e.key === 'Enter') setParam('location', (e.target as HTMLInputElement).value.trim()) }}
      onBlur={e => { if ((e.target.value.trim() || '') !== (params.get('location') || '')) setParam('location', e.target.value.trim()) }}
    />
  )

  const savedChip = showSaved ? (
    <button
      type="button"
      className={`chip${params.get('saved') === '1' ? ' on' : ''}`}
      onClick={() => setParam('saved', params.get('saved') === '1' ? '' : '1')}
    >
      Saved
    </button>
  ) : null

  const platformOpts: ReadonlyArray<readonly [string, string]> = [['', 'Any platform'], ...SOCIAL_PLATFORMS.map(p => [p, p[0].toUpperCase() + p.slice(1)] as const)]
  const nicheOpts: ReadonlyArray<readonly [string, string]> = [['', 'Any niche'], ...CREATOR_NICHES.map(n => [n, NICHE_LABELS[n]] as const)]
  const availOpts: ReadonlyArray<readonly [string, string]> = [['', 'Any availability'], ...AVAILABILITY_STATUSES.map(a => [a, AVAILABILITY_LABELS[a]] as const)]

  return (
    <>
      {/* Desktop: the full inline filter bar (unchanged). */}
      <div className="cf-inline" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {select('platform', platformOpts)}
        {select('niche', nicheOpts)}
        {select('followers', FOLLOWER_TIERS)}
        {select('availability', availOpts)}
        {select('maxRate', RATE_CAPS)}
        {locationInput()}
        {savedChip}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFilters && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => router.push('/creators')}>Clear</button>
          )}
          {select('sort', SORTS)}
        </div>
      </div>

      {/* Phones: a single Filters button (opens a sheet) + the sort control. */}
      <div className="cf-mobile" style={{ gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5 }}>
          <SlidersHorizontal size={15} /> Filters{activeCount ? ` · ${activeCount}` : ''}
        </button>
        <div style={{ marginLeft: 'auto' }}>{select('sort', SORTS)}</div>
      </div>

      {/* Mobile filter sheet. Filters apply live (URL updates on change); the
          buttons just clear or close. */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,16,22,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface, #fff)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '16px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 30px rgba(14,16,22,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Filters</div>
              <button type="button" aria-label="Close filters" onClick={() => setOpen(false)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-faint-solid)', display: 'grid', placeItems: 'center', width: 32, height: 32 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Platform">{select('platform', platformOpts, true)}</Field>
              <Field label="Niche">{select('niche', nicheOpts, true)}</Field>
              <Field label="Followers">{select('followers', FOLLOWER_TIERS, true)}</Field>
              <Field label="Availability">{select('availability', availOpts, true)}</Field>
              <Field label="Max rate">{select('maxRate', RATE_CAPS, true)}</Field>
              <Field label="Location">{locationInput(true)}</Field>
              {savedChip && <div>{savedChip}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {hasFilters && (
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => { router.push('/creators'); setOpen(false) }}>
                  Clear all
                </button>
              )}
              <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setOpen(false)}>
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}
