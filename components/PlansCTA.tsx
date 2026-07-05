'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import PlansPanel from '@/components/PlansPanel'

// Button that opens the shared two-tier pricing panel (Pro + Plus) in a modal.
//
// The modal is PORTALED to <body>. Rendered inline it was a descendant of the
// billing "Do more with Plus" card, whose overflow:hidden + hover `transform`
// makes the card a containing block for position:fixed — so the fixed overlay was
// positioned AND clipped inside that card (and jittered as the hover toggled).
// A portal detaches it from that ancestor, so it covers the real viewport.
export default function PlansCTA({
  beta, label = 'View plans', variant = 'primary',
}: { beta: boolean; label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <>
      <button type="button" className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'} onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={15} /> {label}
      </button>

      {open && mounted && createPortal(
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,10,30,.62)', overflowY: 'auto',
        }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <PlansPanel beta={beta} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
