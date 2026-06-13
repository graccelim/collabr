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
  { key: 'all', label: 'All', dot: null, softBg: 'var(--ink)', softFg: '#fff' },
  { key: 'needs', label: 'Needs you', dot: 'var(--warn)', softBg: 'var(--warn-tint)', softFg: 'var(--warn-deep)' },
  { key: 'progress', label: 'In progress', dot: 'var(--accent)', softBg: 'var(--accent-tint)', softFg: 'var(--accent-deep)' },
  { key: 'completed', label: 'Completed', dot: 'var(--money)', softBg: 'var(--money-tint)', softFg: 'var(--money-deep)' },
] as const

// 5-step escrow as cute rounded segments — green where money-secured steps are
// cleared, grey ahead. Friendlier than a single progress bar.
function MiniSteps({ step }: { step: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{
          width: 10, height: 5, borderRadius: 99,
          background: i < step ? 'var(--money)' : 'var(--surface-3, #E1E4EA)',
        }} />
      ))}
    </span>
  )
}

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
        {FILTERS.map(f => {
          const on = filter === f.key
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                height: 32, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: 540, fontFamily: 'var(--font-body)',
                background: on ? f.softBg : 'var(--surface)',
                color: on ? f.softFg : 'var(--ink-soft)',
                border: `1px solid ${on ? 'transparent' : 'var(--line-strong)'}`,
                transition: 'all .14s ease',
              }}>
              {f.dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: f.dot, flexShrink: 0 }} />}
              {f.label} · {count(f.key)}
            </button>
          )
        })}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={`Escrow step ${r.step} of 5`}>
                  <MiniSteps step={r.step} />
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
