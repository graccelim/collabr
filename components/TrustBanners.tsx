'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { MailWarning, UserCheck, BarChart3 } from 'lucide-react'

interface Props {
  emailVerified: boolean
  onboardingComplete: boolean
  role: 'brand' | 'creator'
  /** At least one social profile is missing a follower count. */
  needsFollowers?: boolean
  /** Where to send them to add followers (profile / settings). */
  profileHref?: string
}

export default function TrustBanners({ emailVerified, onboardingComplete, role, needsFollowers = false, profileHref = '/profile' }: Props) {
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

  // Don't nudge for followers on the very page where they'd add them.
  const showFollowers = needsFollowers && pathname !== profileHref
  if (emailVerified && onboardingComplete && !showFollowers) return null

  return (
    <div className="space-y-2 mb-5">
      {!emailVerified && (
        <div className="card flex items-center gap-3 py-2.5"
          style={{ borderColor: 'rgba(217,119,6,.3)', background: 'var(--warn-tint)' }}>
          <MailWarning size={16} className="shrink-0" style={{ color: 'var(--warn)' }} />
          <p className="text-sm text-gray-700 flex-1">
            Verify your email to {role === 'creator' ? 'apply to campaigns' : 'create campaigns'}.
          </p>
          <button onClick={resend} disabled={sending || sent}
            className="text-sm font-medium disabled:opacity-60"
            style={{ color: 'var(--warn-deep)' }}>
            {sent ? 'Sent ✓' : sending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}
      {/* Hidden on the dashboard home — the "Welcome to Collabr" completion card
          already prompts this there (avoids a redundant double nudge). Links to
          the editable profile, not /onboarding (which just bounces to overview). */}
      {!onboardingComplete && pathname !== '/onboarding' && pathname !== '/dashboard' && (
        <div className="card flex items-center gap-3 py-2.5"
          style={{ borderColor: 'rgba(79,70,229,.25)', background: 'var(--accent-tint)' }}>
          <UserCheck size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="text-sm text-gray-700 flex-1">
            {role === 'creator'
              ? 'Complete onboarding to apply to campaigns.'
              : 'Complete onboarding to create campaigns.'}
          </p>
          <Link href={profileHref} className="text-sm font-medium"
            style={{ color: 'var(--accent-deep)' }}>
            Finish setup →
          </Link>
        </div>
      )}
      {showFollowers && (
        <div className="card flex items-center gap-3 py-2.5"
          style={{ borderColor: 'rgba(58,108,210,.25)', background: '#eef3fd' }}>
          <BarChart3 size={16} className="shrink-0" style={{ color: '#3a6cd2' }} />
          <p className="text-sm text-gray-700 flex-1">
            {role === 'creator'
              ? 'Add your follower counts so brands can find and trust you faster.'
              : 'Add your follower counts so creators can size up your reach.'}
          </p>
          <Link href={profileHref} className="text-sm font-medium" style={{ color: '#2a55b8' }}>
            Add followers →
          </Link>
        </div>
      )}
    </div>
  )
}
