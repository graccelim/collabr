'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { MailWarning, UserCheck } from 'lucide-react'

interface Props {
  emailVerified: boolean
  onboardingComplete: boolean
  role: 'brand' | 'creator'
}

export default function TrustBanners({ emailVerified, onboardingComplete, role }: Props) {
  const pathname = usePathname()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function resend() {
    if (sending || sent) return
    setSending(true)
    const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Could not resend email')
    else { toast.success('Verification email sent'); setSent(true) }
    setSending(false)
  }

  if (emailVerified && onboardingComplete) return null

  return (
    <div className="space-y-2 mb-6">
      {!emailVerified && (
        <div className="card flex items-center gap-3 py-3" style={{ borderColor: '#fbbf24', background: '#fffbeb' }}>
          <MailWarning size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-gray-700 flex-1">
            Verify your email to {role === 'creator' ? 'apply to campaigns' : 'create campaigns'}.
          </p>
          <button onClick={resend} disabled={sending || sent}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-60">
            {sent ? 'Sent ✓' : sending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}
      {!onboardingComplete && pathname !== '/onboarding' && (
        <div className="card flex items-center gap-3 py-3" style={{ borderColor: '#5eead4', background: '#f0fdfa' }}>
          <UserCheck size={18} className="text-teal-500 shrink-0" />
          <p className="text-sm text-gray-700 flex-1">
            {role === 'creator'
              ? 'Complete onboarding to apply to campaigns.'
              : 'Complete onboarding to create campaigns.'}
          </p>
          <Link href="/onboarding" className="text-sm font-medium text-teal-700 hover:text-teal-900">
            Finish setup →
          </Link>
        </div>
      )}
    </div>
  )
}
