'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star, Megaphone, Loader2 } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import AccountForm from '@/components/AccountForm'
import { safeNextPath } from '@/lib/nav'

/**
 * Minimal signup (2026-07 onboarding redesign): role + name + email + password.
 * Everything else (socials, niches, company details) moved into the in-product
 * onboarding checklist shown after email verification.
 */
function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const loginHref = next === '/dashboard' ? '/login' : `/login?next=${encodeURIComponent(next)}`
  const roleParam = params.get('role')
  // Defaults to brand, not creator: every creator-facing "join" button in the
  // app already points to /join, which checks for a profile we may have
  // already seeded before deciding whether to activate or create one.
  const defaultRole = roleParam === 'brand' || roleParam === 'creator' ? roleParam : 'brand'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  // Set only by /join's own "no profile found" link - the one legitimate way
  // to reach the real creator form directly, since /join already did the
  // lookup. Every other path that ends with role='creator' has NOT been
  // checked yet.
  const fromJoin = params.get('from') === 'join'
  const needsCheck = role === 'creator' && !fromJoin

  // Selecting "I'm a creator" sends straight to /join - no separate
  // "here's why, click Continue" screen. That extra screen plus the earlier
  // behavior of bouncing back to THIS page afterwards was the actual loop -
  // one instant redirect the moment someone declares their role removes both
  // the extra click and the round trip.
  useEffect(() => {
    if (needsCheck) router.replace('/join')
  }, [needsCheck, router])

  if (needsCheck) {
    return (
      <AuthShell role="creator">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-faint-solid)' }} />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell role={role}>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Create your account</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 22 }}>
        {role === 'brand' ? 'Post a campaign and find creators who fit.' : 'Set up your profile and start getting paid.'}
      </p>

      {/* role toggle */}
      <div style={{ display: 'flex', background: 'var(--paper-2)', padding: 4, borderRadius: 'var(--radius)', gap: 3, marginBottom: 26 }}>
        {([['creator', "I'm a creator", Star], ['brand', "I'm a brand", Megaphone]] as const).map(([r, lbl, Ic]) => (
          <button key={r} type="button" onClick={() => setRole(r)} style={{
            flex: 1, height: 44, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 540,
            background: role === r ? 'var(--surface)' : 'transparent',
            color: role === r ? 'var(--ink)' : 'var(--ink-faint-solid)',
            boxShadow: role === r ? 'var(--shadow-sm)' : 'none', transition: 'all .15s',
          }}>
            <Ic size={16} /> {lbl}
          </button>
        ))}
      </div>

      <AccountForm role={role} next={next} />

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        Already have an account?{' '}
        <Link href={loginHref} style={{ color: 'var(--accent)', fontWeight: 530 }}>Log in</Link>
      </p>
    </AuthShell>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
