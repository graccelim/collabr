'use client'
import { Toaster, ToastBar, toast } from 'react-hot-toast'
import { X } from 'lucide-react'

/**
 * App toaster with an explicit dismiss button on every toast — the default
 * react-hot-toast only shows a status icon (which users mistake for a close
 * control), so taps did nothing. Toasts still auto-dismiss.
 */
export default function Toasts() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4500,
        style: {
          fontFamily: 'var(--font-body)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          maxWidth: 380,
        },
      }}
    >
      {t => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
              {icon}
              <div style={{ flex: 1, minWidth: 0 }}>{message}</div>
              {t.type !== 'loading' && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Dismiss"
                  style={{
                    flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer',
                    color: 'var(--ink-faint-solid)', padding: 2, marginTop: 1, display: 'grid', placeItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  )
}
