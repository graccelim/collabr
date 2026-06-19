'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * Lets a creator withdraw their own still-open application (pending/shortlisted),
 * after a confirmation modal. Withdrawing is reversible — they can apply again
 * while the campaign is still open. The server enforces the allowed states.
 */
export default function WithdrawApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function withdraw() {
    setBusy(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Application withdrawn')
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not withdraw')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{ border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Withdraw
      </button>

      {open && (
        <div onClick={() => !busy && setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,16,22,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface, #fff)', width: '100%', maxWidth: 380, borderRadius: 16, padding: '22px 22px 18px', boxShadow: '0 20px 50px rgba(14,16,22,.25)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Withdraw application?</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 20px' }}>
              You can apply again later if this campaign is still open.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setOpen(false)} disabled={busy}>
                Keep application
              </button>
              <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={withdraw} disabled={busy}>
                {busy ? 'Withdrawing…' : 'Withdraw application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
