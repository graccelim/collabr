import { requireCreator } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { boostUiEnabled, boostPreview } from '@/lib/stripe'
import { Zap, UserCheck } from 'lucide-react'
import Link from 'next/link'
import BoostPurchase from '@/components/BoostPurchase'

export default async function BoostPage() {
  const user = await requireCreator()
  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('boost_active_until, onboarding_completed_at').eq('user_id', user.id).single()

  // Boost is a PAID feature - hidden until Stripe pricing is configured (or the
  // developer-only BOOST_UI_PREVIEW flag is on).
  if (!boostUiEnabled()) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius)', background: 'var(--surface-2)', color: 'var(--ink-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
        }}>
          <Zap size={26} />
        </div>
        <h1 style={{ fontSize: 24 }}>Boost is coming soon</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginTop: 8, lineHeight: 1.55 }}>
          Paid placement isn&rsquo;t available just yet. Your applications and profile work exactly as
          usual, brands rank you on genuine fit, ratings and responsiveness.
        </p>
      </div>
    )
  }

  // Boosting an undiscoverable profile wastes money - require a complete profile.
  if (!creator?.onboarding_completed_at) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius)', background: 'var(--accent-tint)', color: 'var(--accent-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
        }}>
          <UserCheck size={26} />
        </div>
        <h1 style={{ fontSize: 24 }}>Finish your profile before boosting</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginTop: 8, lineHeight: 1.55 }}>
          Boost lifts where you appear, but brands need a complete profile (your niche and at least
          one connected social) to act on it. Wrap that up first, then come back to boost.
        </p>
        <Link href="/onboarding" className="btn-primary" style={{ marginTop: 18, display: 'inline-flex' }}>
          Finish your profile
        </Link>
      </div>
    )
  }

  return <BoostPurchase initialBoostUntil={creator?.boost_active_until ?? null} preview={boostPreview()} />
}
