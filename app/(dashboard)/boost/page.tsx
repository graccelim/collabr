import { requireCreator } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { boostEnabled } from '@/lib/stripe'
import { Zap } from 'lucide-react'
import BoostPurchase from '@/components/BoostPurchase'

export default async function BoostPage() {
  const user = await requireCreator()
  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('boost_active_until').eq('user_id', user.id).single()

  // Boost is a PAID feature — hidden entirely until Stripe pricing is configured.
  if (!boostEnabled()) {
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
          usual — brands rank you on genuine fit, ratings and responsiveness.
        </p>
      </div>
    )
  }

  return <BoostPurchase initialBoostUntil={creator?.boost_active_until ?? null} />
}
