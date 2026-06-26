'use client'
import { useState } from 'react'
import { BarChart3, ArrowRight } from 'lucide-react'
import { flags } from '@/lib/flags'
import CreatorProPanel from '@/components/CreatorProPanel'

// Compact, compelling one-liner on the overview. Clicking opens the Creator Pro
// modal (premium panel with transitions). Renders only when Creator Pro is on.
export default function CreatorProCTA({ returnTo = '/studio' }: { returnTo?: string }) {
  const [open, setOpen] = useState(false)
  if (!flags.creatorPro) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, borderRadius: 'var(--radius)',
        padding: '13px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(100deg, #232c57 0%, #0e1538 60%, #05081c 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'rgba(91,83,224,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={16} color="#fff" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Unlock your analytics with Creator Pro</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>See what's working, win more brand deals, and keep more of every collab.</span>
        </span>
        <ArrowRight size={18} style={{ flexShrink: 0, opacity: .85 }} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.55)', backdropFilter: 'blur(3px)', overflowY: 'auto',
        }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <CreatorProPanel returnTo={returnTo} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
