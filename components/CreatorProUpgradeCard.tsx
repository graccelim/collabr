import { ShieldCheck, BarChart3, Bot, Sparkles } from 'lucide-react'
import { flags } from '@/lib/flags'
import CreatorProCheckoutButton from '@/components/CreatorProCheckoutButton'

/**
 * Creator Pro 💎 upgrade card — premium, non-gamified, business-tool tone.
 * Renders only when the `creator_pro` flag is on. Dismissible/secondary action
 * is handled by the parent (it's just a presentational card here). No outcome
 * promises ("guaranteed acceptance") — confidence framing only.
 *
 * `href` points at the checkout entry (wired in a later step once Stripe prices
 * exist); until then it can link to a preview/pricing page.
 */
export default function CreatorProUpgradeCard({
  returnTo,
  onMaybeLater,
}: {
  returnTo?: string // in-app path to come back to after checkout
  onMaybeLater?: string // optional href for the secondary action
}) {
  if (!flags.creatorPro) return null

  const perks: { icon: typeof ShieldCheck; text: string }[] = [
    { icon: ShieldCheck, text: 'Connected Creator badge' },
    { icon: BarChart3, text: 'Live performance analytics' },
    { icon: Sparkles, text: 'Creator Studio' },
    { icon: Bot, text: 'AI Growth Coach' },
  ]

  return (
    <section
      style={{
        borderRadius: 'var(--radius)',
        padding: 20,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(100deg, transparent 58%, rgba(118,146,228,0.05) 74%, rgba(128,156,238,0.10) 82%, rgba(118,146,228,0.02) 90%, transparent 98%), radial-gradient(115% 105% at 84% -14%, rgba(150,172,235,0.09), transparent 42%), linear-gradient(152deg, #232c57 0%, #0e1538 46%, #05081c 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>
        Creator Pro
      </span>
      <h2
        className="display-face"
        style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px' }}
      >
        Become a Connected Creator ⭐
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--accent-on-dark)', lineHeight: 1.5, margin: '0 0 14px', maxWidth: 460 }}>
        Show brands automatically synced performance metrics and unlock Creator Studio.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxWidth: 460 }}>
        {perks.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#e7e9f5' }}>
            <p.icon size={15} style={{ flexShrink: 0, color: 'var(--accent-on-dark)' }} />
            {p.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <CreatorProCheckoutButton
          plan="monthly"
          returnTo={returnTo}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5,
            borderRadius: 'var(--radius-sm)', padding: '10px 18px', border: 0, cursor: 'pointer',
          }}
        >
          Upgrade to Creator Pro
        </CreatorProCheckoutButton>
        {onMaybeLater && (
          <a href={onMaybeLater} style={{ fontSize: 13, color: 'var(--accent-on-dark)', textDecoration: 'none' }}>
            Maybe later
          </a>
        )}
      </div>
    </section>
  )
}
