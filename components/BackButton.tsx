'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Goes back to the page the user came from (browser history), falling back to a
// sensible route when there's no history (e.g. opened directly).
export default function BackButton({ fallback = '/dashboard', label = 'Back' }: { fallback?: string; label?: string }) {
  const router = useRouter()
  return (
    <button type="button"
      onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push(fallback) }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', padding: '2px 0', marginBottom: 6 }}>
      <ArrowLeft size={16} /> {label}
    </button>
  )
}
