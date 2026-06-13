'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'

export interface CampaignRow {
  id: string
  title: string
  status: string
  comp_type: string | null
  budget_min: number | null
  budget_max: number | null
  creators_needed: number
  deadline: string | null
  /** Count of applications for this campaign. */
  applicants: number
  /** Count of active (non-cancelled) collabs for this campaign. */
  spotsFilled: number
  /** Sum of funded escrow (in cents) currently held for this campaign. */
  inEscrow: number
  /** Display names of a few applicants, for the overlapping avatar footer. */
  applicantNames: string[]
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
] as const

function fmtDeadline(deadline: string | null): string {
  if (!deadline) return '—'
  return new Date(deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

/**
 * Campaigns list with the prototype's status-filter pills (All / Active /
 * Draft / Completed with live counts), each campaign rendered as a rich card:
 * a 5-column stat grid (Applicants · Spots filled · Budget · Due · In escrow)
 * and, for active campaigns with applicants, an avatar footer + review CTA.
 */
export default function CampaignList({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter()
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shown.map(c => {
          const budget = c.budget_min
            ? `${formatSGD(c.budget_min)}${c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}`
            : c.comp_type === 'barter' ? 'Barter' : '—'
          const isActive = c.status === 'active'
          const open = () => router.push(`/campaigns/${c.id}`)

          const stats: { k: string; v: string; mono?: boolean; money?: boolean }[] = [
            { k: 'Applicants', v: String(c.applicants) },
            { k: 'Spots filled', v: `${c.spotsFilled}/${c.creators_needed}` },
            { k: 'Budget', v: budget, mono: true },
            { k: 'Due', v: fmtDeadline(c.deadline), mono: true },
            { k: 'In escrow', v: formatSGD(c.inEscrow), mono: true, money: c.inEscrow > 0 },
          ]

          return (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={open}
              onKeyDown={e => { if (e.key === 'Enter') open() }}
              className="card card-hover"
              style={{ padding: 20, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 16.5, fontWeight: 560, color: 'var(--ink)' }}>{c.title}</span>
                  <span className={`badge ${isActive ? 'badge-money' : c.status === 'draft' ? 'badge-neutral' : 'badge-accent'}`} style={{ textTransform: 'capitalize' }}>{c.status}</span>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
              </div>

              <div className="resp-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {stats.map(s => (
                  <div key={s.k}>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>{s.k}</div>
                    <div
                      className={s.mono ? 'mono-num' : undefined}
                      style={{ fontSize: 14.5, fontWeight: 540, color: s.money ? 'var(--money-deep)' : 'var(--ink)' }}
                    >
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>

              {isActive && c.applicants > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    {c.applicantNames.slice(0, 3).map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          marginLeft: i ? -10 : 0,
                          background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, fontSize: 11,
                          boxShadow: '0 0 0 2px var(--surface)',
                        }}
                      >
                        {getInitials(name)}
                      </span>
                    ))}
                    <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
                      {c.applicants} creator{c.applicants > 1 ? 's' : ''} applied
                      {c.applicants > 3 ? ` · ${c.applicants - 3} more` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ height: 32, fontSize: 13, padding: '0 13px', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); open() }}
                  >
                    Review applicants <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {shown.length === 0 && (
          <div className="card" style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>
            No {filter} campaigns.
          </div>
        )}
      </div>
    </>
  )
}
