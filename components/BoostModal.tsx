'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import BoostPurchase from './BoostPurchase'

/**
 * Lightweight boost dialog (centered on desktop, bottom sheet on mobile). Keeps
 * the creator in context - the actual payment still hands off to Stripe Checkout
 * and returns to the page it was opened from. Reuses BoostPurchase for content.
 *
 * PORTALED to <body> (same fix as PlansCTA): rendered inline it sits under
 * ancestors whose transform/overflow make them the containing block for
 * position:fixed, so the overlay left a gap at the top instead of covering the
 * viewport.
 */
export default function BoostModal({
  open, onClose, preview, boostUntil,
}: { open: boolean; onClose: () => void; preview: boolean; boostUntil: string | null }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="boost-modal-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(10,12,34,.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <motion.div
            className="boost-modal-card"
            role="dialog" aria-modal="true" aria-label="Boost your profile"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
              position: 'relative', padding: '24px 22px',
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 8,
                border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={18} />
            </button>
            <BoostPurchase initialBoostUntil={boostUntil} preview={preview} returnTo={pathname} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
