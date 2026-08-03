import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { PartyPopper, Check } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimitDurable, clientIpFromHeaders } from '@/lib/rate-limit'
import { findCreatorBySocial } from '@/lib/creator-discovery'
import CreatorClaimInviteCard from '@/components/CreatorClaimInviteCard'
import { SOCIAL_PLATFORMS, SOCIAL_LABELS, type SocialPlatform } from '@/lib/onboarding'

export const metadata: Metadata = {
  title: 'Join as a creator',
  description: 'Brands are already looking for creators like you. Tell us your main platform and handle, we’ll take it from there.',
}

const BENEFITS = [
  'Receive collaboration requests directly',
  'Manage your campaigns in one place',
  'Protected payments',
  'Everything is free during beta',
]

function isSocialPlatform(v: string | undefined): v is SocialPlatform {
  return !!v && (SOCIAL_PLATFORMS as readonly string[]).includes(v)
}

// The single creator entry point: one CTA everywhere ("Join Collabr") leads
// here, which asks for a platform + handle and lets the SYSTEM decide what
// happens next - a creator never has to know whether they're "claiming" a
// seeded profile or creating a new one. Lookup reuses findCreatorBySocial
// (an exact platform+handle match against social_accounts, the same key the
// admin tool writes), so there's no separate/fuzzy matching logic here.
export default async function JoinPage({ searchParams }: { searchParams: { platform?: string; handle?: string } }) {
  const platform = isSocialPlatform(searchParams.platform) ? searchParams.platform : undefined
  const handle = (searchParams.handle || '').trim()
  const searched = Boolean(platform && handle)

  let found: { id: string; user_id: string | null } | null = null
  let rateLimited = false

  if (searched && platform) {
    const ip = clientIpFromHeaders(headers())
    const allowed = await checkRateLimitDurable(`join-lookup:${ip}`, 20, 5 * 60 * 1000)
    if (!allowed) {
      rateLimited = true
    } else {
      const admin = createAdminClient()
      found = await findCreatorBySocial(admin, platform, handle)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'inline-grid', placeItems: 'center', marginBottom: 14 }}>
          <PartyPopper size={22} />
        </span>
        <h1 className="display-face" style={{ fontSize: 'clamp(24px,3.6vw,32px)', letterSpacing: '-0.02em', marginBottom: 10 }}>
          Brands are already looking for creators like you.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Join Collabr to receive collaboration requests directly, manage your campaigns and get paid securely.
        </p>
      </div>

      {rateLimited ? (
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
          Too many attempts. Please try again in a few minutes.
        </p>
      ) : searched && found ? (
        found.user_id ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>You're already on Collabr.</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 16 }}>This profile has already been activated.</p>
            <Link href="/login" className="btn-primary">Log in</Link>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>🎉 Great news!</p>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                We found your creator profile. We'll send you a secure activation link shortly so you can activate
                your Collabr profile and start receiving collaboration requests.
              </p>
            </div>
            <CreatorClaimInviteCard creatorId={found.id} buttonLabel="Request Activation" showIntro={false} />
          </div>
        )
      ) : searched ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            We couldn't find an existing creator profile.
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Let's create your free Collabr account.
          </p>
          <Link href="/signup?role=creator" className="btn-primary">Create your account</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {BENEFITS.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)' }}>
                <Check size={15} style={{ color: 'var(--money)', flexShrink: 0 }} /> {b}
              </div>
            ))}
          </div>

          <form action="/join" method="GET" className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">What's your main creator platform?</label>
              <select name="platform" className="input" defaultValue="instagram">
                {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{SOCIAL_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Your username or handle</label>
              <input type="text" name="handle" className="input" placeholder="@yourhandle" required />
            </div>
            <button type="submit" className="btn-primary btn-block" style={{ justifyContent: 'center' }}>Continue</button>
          </form>

          <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
            If we already found your public creator profile, we'll help you activate it. Otherwise, we'll help you create one.
          </p>
        </>
      )}
    </div>
  )
}
