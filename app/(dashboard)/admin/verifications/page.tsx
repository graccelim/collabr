import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { relativeTime } from '@/lib/utils'
import { socialUrl, type SocialPlatform } from '@/lib/onboarding'
import VerificationActions from '@/components/VerificationActions'
import { ShieldCheck, ExternalLink } from 'lucide-react'

// Admin queue for bio-code social OWNERSHIP verification.
export default async function AdminVerificationsPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: pending } = await admin.from('social_accounts')
    .select('id, platform, handle, verification_code, verification_code_expires_at, verification_requested_at, creator_profiles(users(display_name))')
    .eq('verification_status', 'pending')
    .order('verification_requested_at', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={20} style={{ color: 'var(--money)' }} />
        <h1 style={{ fontSize: 28 }}>Verification queue</h1>
        <span className="badge badge-warn">{pending?.length || 0}</span>
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginTop: -10 }}>
        Open each creator&rsquo;s public profile and confirm the code is in their bio, then approve.
        This verifies <strong>account ownership only</strong> — not follower counts.
      </p>

      {(!pending || pending.length === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--ink-faint-solid)', fontSize: 14 }}>
          No pending verifications. 🎉
        </div>
      ) : (
        <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
          {pending.map(s => {
            const name = (s.creator_profiles as any)?.users?.display_name || 'Creator'
            const url = socialUrl(s.platform as SocialPlatform, s.handle)
            const expired = s.verification_code_expires_at && new Date(s.verification_code_expires_at) < new Date()
            return (
              <div key={s.id} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 560, color: 'var(--ink)' }}>{name}</div>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {s.platform} · @{s.handle} <ExternalLink size={12} />
                    </a>
                  </div>
                  <span className="micro">requested {s.verification_requested_at ? relativeTime(s.verification_requested_at) : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="micro">Expected code in bio:</span>
                  <span className="mono-num" style={{ background: 'var(--surface-2)', padding: '4px 10px', borderRadius: 8, fontSize: 13, color: 'var(--ink)' }}>
                    {s.verification_code || '—'}
                  </span>
                  {expired && <span className="badge badge-warn">code expired</span>}
                </div>
                <VerificationActions socialId={s.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
