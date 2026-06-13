'use client'
import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  /** ISO date 'YYYY-MM-DD' or ''. */
  value: string
  onChange: (iso: string) => void
}

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const addDays = (base: Date, n: number) => { const x = new Date(base); x.setDate(x.getDate() + n); return x }
const addMonths = (base: Date, n: number) => { const x = new Date(base); x.setMonth(x.getMonth() + n); return x }
const isoOf = (d: Date) => toISO(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Date picker (Collabr Redesign): quick presets + a navigable calendar popover.
 * Real date math; emits an ISO 'YYYY-MM-DD' string compatible with the form.
 */
export default function DateField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayISO = isoOf(today)
  const selected = value ? new Date(value + 'T00:00:00') : null

  // The month the calendar is showing — defaults to the selected month or now.
  const [view, setView] = useState(() => {
    const d = selected || today
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const presets: [string, number, 'd' | 'm'][] = [['In 1 week', 7, 'd'], ['In 2 weeks', 14, 'd'], ['In 1 month', 1, 'm']]
  const presetISO = (n: number, unit: 'd' | 'm') => isoOf(unit === 'd' ? addDays(today, n) : addMonths(today, n))
  const activePreset = presets.find(([, n, u]) => presetISO(n, u) === value)?.[0]

  const firstOffset = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const label = selected
    ? selected.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
    : 'Select a date'
  const year = selected ? selected.getFullYear() : view.y

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* quick presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {presets.map(([lbl, n, u]) => (
          <button
            key={lbl}
            type="button"
            className={`chip${activePreset === lbl ? ' on' : ''}`}
            onClick={() => { onChange(presetISO(n, u)); setOpen(false) }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* field */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', height: 46, padding: '0 14px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--line-strong)'}`, background: 'var(--surface)',
            boxShadow: open ? '0 0 0 3px var(--accent-tint)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
            fontFamily: 'var(--font-body)', transition: 'border .15s, box-shadow .15s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={17} style={{ color: 'var(--ink-faint-solid)' }} />
            <span className="mono-num" style={{ fontSize: 14, color: selected ? 'var(--ink)' : 'var(--ink-faint-solid)', fontWeight: 500 }}>{label}</span>
            {selected && <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>· {year}</span>}
          </span>
          <ChevronDown size={16} style={{ color: 'var(--ink-faint-solid)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 52, left: 0, zIndex: 40, width: 290, padding: 14,
            borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--line)',
            boxShadow: '0 10px 34px -10px rgba(16,17,22,0.28)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
              <button type="button" onClick={() => setView(v => { const d = new Date(v.y, v.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })}
                style={navBtn}><ChevronLeft size={15} /></button>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[view.m]} {view.y}</span>
              <button type="button" onClick={() => setView(v => { const d = new Date(v.y, v.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })}
                style={navBtn}><ChevronRight size={15} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
              {WD.map((d, i) => <div key={i} className="micro" style={{ textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {Array.from({ length: firstOffset }).map((_, i) => <div key={'o' + i} />)}
              {days.map(d => {
                const iso = toISO(view.y, view.m, d)
                const on = iso === value
                const isToday = iso === todayISO
                const past = iso < todayISO
                return (
                  <button key={d} type="button" disabled={past}
                    onClick={() => { onChange(iso); setOpen(false) }}
                    style={{
                      height: 34, borderRadius: 8, border: 'none', cursor: past ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: 13,
                      background: on ? 'var(--accent)' : 'transparent',
                      color: on ? '#fff' : past ? 'var(--ink-faint-solid)' : 'var(--ink)',
                      opacity: past ? 0.5 : 1, fontWeight: isToday ? 700 : 500, position: 'relative', transition: 'background .12s',
                    }}
                    onMouseEnter={e => { if (!on && !past) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                    {d}
                    {isToday && !on && <span style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 99, background: 'var(--accent)' }} />}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(false)}>Set date</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--surface-2)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)',
}
