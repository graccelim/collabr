import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { PartyPopper, Check } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimitDurable, clientIpFromHeaders } from '@/lib/rate-limit'
import { findCreatorBySocial } from '@/lib/creator-discovery'
import CreatorClaimInviteCard from '@/components/CreatorClaimInviteCard'
import Avatar from '@/components/Avatar'
import { SOCIAL_PLATFORMS, SOCIAL_LABELS, type SocialPlatform } from '@/lib/onboarding'
import AccountForm from '@/components/AccountForm'

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

function joinUrl(platform: string, handle: string, confirm?: 'yes' | 'no') {
  const qs = new URLSearchParams({ platform, handle })
  if (confirm) qs.set('confirm', confirm)
  return `/join?${qs.toString()}`
}

// The single creator entry point: one CTA everywhere ("Join Collabr") leads
// here, which asks for a platform + handle and lets the SYSTEM decide what
// happens next - a creator never has to know whether they're "claiming" a
// seeded profile or creating a new one. Lookup reuses findCreatorBySocial
// (an exact platform+handle match against social_accounts, the same key the
// admin tool writes), so there's no separate/fuzzy matching logic here.
//
// A match is shown as a QUESTION ("is this your creator profile?"), not an
// announcement ("we found you") - benefits and activation mechanics only
// appear after the creator confirms it's them, never before. Presenting a
// found profile as already-known-to-us before they've agreed is exactly the
// "wait, who told you that" feeling this whole pass exists to avoid.
export default async function JoinPage({
  searchParams,
}: {
  searchParams: { platform?: string; handle?: string; confirm?: string }
}) {
  const platform = isSocialPlatform(searchParams.platform) ? searchParams.platform : undefined
  const handle = (searchParams.handle || '').trim()
  const searched = Boolean(platform && handle)
  const confirm = searchParams.confirm === 'yes' || searchParams.confirm === 'no' ? searchParams.confirm : null

  let found: { id: string; user_id: string | null; displayName: string } | null = null
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
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '56px 20px 80px', position: 'relative' }}>
      <div aria-hidden style={{
        position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
        width: 480, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,4,53,.08), transparent 68%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 30 }}>
        <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'inline-grid', placeItems: 'center', marginBottom: 16 }}>
          <PartyPopper size={24} />
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
      ) : searched && found && found.user_id ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>You're already on Collabr.</p>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 16 }}>This profile has already been activated.</p>
          <Link href="/login" className="btn-primary">Log in</Link>
        </div>
      ) : searched && found && confirm === 'yes' ? (
        // Only past this point does the page talk about how it works.
        <div className="card" style={{ padding: 24 }}>
          <CreatorClaimInviteCard creatorId={found.id} buttonLabel="Request Activation" contactPlatform={platform as SocialPlatform} />
        </div>
      ) : searched && found && confirm === 'no' ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No problem.</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <Link href="/join" style={{ color: 'var(--accent)', fontWeight: 530 }}>Try a different platform or handle</Link>, or create a new account below.
            </p>
          </div>
          <AccountForm role="creator" />
        </div>
      ) : searched && found ? (
        // The confirmation step itself - just identity, nothing else.
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <Avatar src={null} name={found.displayName} size={64} />
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>{found.displayName}</p>
          <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 2, marginBottom: 22 }}>
            {SOCIAL_LABELS[platform as SocialPlatform]} · @{handle.replace(/^@+/, '')}
          </p>
          <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
            Is this your creator profile?
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link href={joinUrl(platform as string, handle, 'yes')} className="btn-primary">Yes, that's me</Link>
            <Link href={joinUrl(platform as string, handle, 'no')} className="btn-secondary">No, that's not me</Link>
          </div>
        </div>
      ) : searched ? (
        <div className="card" style={{ padding: '28px 24px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
              No existing profile found
            </p>
            <h2 className="display-face" style={{ fontSize: 'clamp(20px,2.6vw,26px)', letterSpacing: '-0.02em', marginBottom: 20 }}>
              Let's get you set up.
            </h2>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 9, textAlign: 'left', marginBottom: 26 }}>
              {BENEFITS.map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14.5, color: 'var(--ink)' }}>
                  <Check size={16} style={{ color: 'var(--money)', flexShrink: 0 }} /> {b}
                </div>
              ))}
            </div>
          </div>
          <AccountForm role="creator" />
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
