'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import PlansPanel from '@/components/PlansPanel'

// Button that opens the shared two-tier pricing panel (Pro + Plus) in a modal.
export default function PlansCTA({
  beta, label = 'View plans', variant = 'primary',
}: { beta: boolean; label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'} onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={15} /> {label}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          // No backdrop-filter: blurring the whole page over the billing plus-card's
          // infinite shine animation forced a per-frame re-rasterize → severe jank.
          // A solid dim overlay reads the same and is GPU-cheap.
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.62)', overflowY: 'auto',
        }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <PlansPanel beta={beta} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
