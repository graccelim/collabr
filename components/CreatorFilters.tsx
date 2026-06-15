'use client'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function CreatorFilters({ showSaved }: { showSaved: boolean }) {
  const router = useRouter()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page') // any filter change resets pagination
    router.push(`/creators?${next.toString()}`)
  }

  const hasFilters = ['platform', 'niche', 'followers', 'availability', 'maxRate', 'location', 'saved']
    .some(k => params.get(k))

  const select = (key: string, options: ReadonlyArray<readonly [string, string]>) => (
    <select
      className="input"
      style={{ width: 'auto', fontSize: 13, padding: '6px 32px 6px 11px' }}
      value={params.get(key) || ''}
      onChange={e => setParam(key, e.target.value)}
    >
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {select('platform', [['', 'Any platform'], ...SOCIAL_PLATFORMS.map(p => [p, p[0].toUpperCase() + p.slice(1)] as const)])}
      {select('niche', [['', 'Any niche'], ...CREATOR_NICHES.map(n => [n, NICHE_LABELS[n]] as const)])}
      {select('followers', FOLLOWER_TIERS)}
      {select('availability', [['', 'Any availability'], ...AVAILABILITY_STATUSES.map(a => [a, AVAILABILITY_LABELS[a]] as const)])}
      {select('maxRate', RATE_CAPS)}

      <input
        className="input"
        style={{ width: 140, fontSize: 13, padding: '6px 10px' }}
        placeholder="Location"
        defaultValue={params.get('location') || ''}
        onKeyDown={e => {
          if (e.key === 'Enter') setParam('location', (e.target as HTMLInputElement).value.trim())
        }}
        onBlur={e => {
          if ((e.target.value.trim() || '') !== (params.get('location') || '')) {
            setParam('location', e.target.value.trim())
          }
        }}
      />

      {showSaved && (
        <button
          type="button"
          className={`chip${params.get('saved') === '1' ? ' on' : ''}`}
          onClick={() => setParam('saved', params.get('saved') === '1' ? '' : '1')}
        >
          Saved
        </button>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {hasFilters && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => router.push('/creators')}>
            Clear
          </button>
        )}
        {select('sort', SORTS)}
      </div>
    </div>
  )
}
