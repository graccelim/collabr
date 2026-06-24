'use client'
import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * A tiny inline help marker. Tap (or hover on desktop) the icon to reveal a
 * plain-language explanation. Uses a real popover instead of the native `title`
 * attribute, which never appears on touch devices — that was why these "did
 * nothing" on mobile. Used to demystify jargon like "escrow" and "barter".
 */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          marginLeft: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-faint-solid)',
          lineHeight: 0,
        }}
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            width: 'max-content',
            maxWidth: 'min(240px, 70vw)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 500,
            lineHeight: 1.45,
            textAlign: 'left',
            padding: '9px 11px',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
