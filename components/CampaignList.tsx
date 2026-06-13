'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatSGD } from '@/lib/utils'

export interface CampaignRow {
  id: string
  title: string
  status: string
  comp_type: string | null
  budget_min: number | null
  budget_max: number | null
  creators_needed: number
  deadline: string | null
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
] as const

/**
 * Campaigns list with the prototype's status-filter pills (All / Active /
 * Draft / Completed with live counts). Filtering is client-side for instant
 * chip toggles; the dark-active `.chip` matches the design system.
 */
export default function CampaignList({ campaigns }: { campaigns: CampaignRow[] }) {
  const [filter, setFilter] = useState<string>('all')

  const count = (key: string) => key === 'all'
    ? campaigns.length
    : campaigns.filter(c => c.status === key).length

  const shown = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`chip${filter === f.key ? ' on' : ''}`}>
            {f.label} · {count(f.key)}
          </button>
        ))}
      </div>

      <div className="row-list card" style={{ padding: 0, overflow: 'hidden' }}>
        {shown.map(c => {
          const budget = c.budget_min
            ? `${formatSGD(c.budget_min)}${c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}`
            : c.comp_type === 'barter' ? 'Barter' : '—'
          return (
            <Link key={c.id} href={`/campaigns/${c.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: '16px 18px', textDecoration: 'none',
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 560, color: 'var(--ink)' }}>{c.title}</span>
                  <span className={`badge ${c.status === 'active' ? 'badge-money' : c.status === 'draft' ? 'badge-pending' : 'badge-neutral'}`}>{c.status}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                  <span className="mono-num">{budget}</span> per creator · {c.creators_needed} spot{c.creators_needed > 1 ? 's' : ''}
                  {c.deadline ? ` · Due ${new Date(c.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : ''}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
            </Link>
          )
        })}
        {shown.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>
            No {filter} campaigns.
          </div>
        )}
      </div>
    </>
  )
}
