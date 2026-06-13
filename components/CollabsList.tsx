'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface CollabRowData {
  id: string
  counterparty: string
  initials: string
  campaignTitle: string
  step: number
  statusLabel: string
  statusColor: string
  amount: string
  /** Filter bucket the design's chips key off. */
  bucket: 'needs' | 'progress' | 'completed'
  dimmed: boolean
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs', label: 'Needs you' },
  { key: 'progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
] as const

/**
 * Collabs list with the prototype's status-filter chips (All / Needs you /
 * In progress / Completed). Client-side filtering; rows keep the counterparty-
 * first layout + slim escrow track.
 */
export default function CollabsList({ rows }: { rows: CollabRowData[] }) {
  const [filter, setFilter] = useState<string>('all')
  const count = (key: string) => key === 'all' ? rows.length : rows.filter(r => r.bucket === key).length
  const shown = filter === 'all' ? rows : rows.filter(r => r.bucket === filter)

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`chip${filter === f.key ? ' on' : ''}`}>
            {f.label}{f.key !== 'all' || rows.length ? ` · ${count(f.key)}` : ''}
          </button>
        ))}
      </div>

      <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
        {shown.map(r => (
          <Link key={r.id} href={`/collabs/${r.id}`} className="collab-row" style={{
            textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            padding: '17px 20px', background: 'var(--surface)', opacity: r.dimmed ? 0.6 : 1,
            transition: 'background .12s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14,
              }}>{r.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 550, color: 'var(--ink)' }}>{r.counterparty}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaignTitle}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} title={`Escrow step ${r.step} of 5`}>
                  <div className="mini-escrow-track"><div className="mini-escrow-fill" style={{ width: `${(r.step / 5) * 100}%` }} /></div>
                  <span className="mono-num" style={{ fontSize: 11, color: 'var(--ink-faint-solid)', letterSpacing: '0.02em' }}>{r.step}/5</span>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: r.statusColor }}>{r.statusLabel}</span>
              </div>
              <span className="mono-num" style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 540, minWidth: 56, textAlign: 'right' }}>{r.amount}</span>
              <ChevronRight size={17} style={{ color: 'var(--ink-faint-solid)' }} />
            </div>
          </Link>
        ))}
        {shown.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>
            Nothing here right now.
          </div>
        )}
      </div>
    </>
  )
}
