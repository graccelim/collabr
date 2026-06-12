'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  action: 'checkout' | 'portal'
  label: string
  variant?: 'primary' | 'secondary'
}

export default function BillingActions({ action, label, variant = 'secondary' }: Props) {
  const [busy, setBusy] = useState(false)

  async function go() {
    if (busy) return
    setBusy(true)
    const res = await fetch(`/api/billing/${action}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast.error(data.error || 'Something went wrong')
      setBusy(false)
      return
    }
    window.location.href = data.url
  }

  return (
    <button
      type="button"
      className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
      onClick={go}
      disabled={busy}
    >
      {busy ? 'Opening…' : label}
    </button>
  )
}
