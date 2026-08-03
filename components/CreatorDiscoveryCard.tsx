import Link from 'next/link'
import { Star } from 'lucide-react'
import Avatar from '@/components/Avatar'
import CreatorActiveBadge from '@/components/CreatorActiveBadge'
import CollabrCertifiedBadge from '@/components/CollabrCertifiedBadge'
import ConnectedCreatorBadge from '@/components/ConnectedCreatorBadge'
import { socialIcon } from '@/components/SocialIcon'
import { NICHE_LABELS, socialHandleLabel, type CreatorNiche, type SocialPlatform } from '@/lib/onboarding'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import { formatSGD } from '@/lib/utils'
import { boostEnabled } from '@/lib/stripe'
import { toCreatorSignals, type ScoreRow } from '@/lib/discovery-data'
import { creatorIndicators } from '@/lib/recommend'
import type { SocialAccount } from '@/types'
import type { DiscoveryCreatorRow } from '@/lib/creator-discovery'

/**
 * The one creator card used everywhere discovery results render - the
 * authenticated Brand Plus dashboard (/creators) and the public browse page
 * (/browse). `saveButton` is an optional slot (SaveCreatorButton on the
 * authenticated side, omitted on the public side, which has nothing to save
 * to yet) so the two pages share pixel-identical cards without a second copy
 * of this markup.
 */
export default function CreatorDiscoveryCard({
  creator: c, socials, score, saveButton,
}: {
  creator: DiscoveryCreatorRow
  socials: SocialAccount[]
  score: ScoreRow | null
  saveButton?: React.ReactNode
}) {
  const name = c.users?.display_name || c.display_name || 'Creator'
  const avatar = c.users?.avatar_url
  const primary = socials[0]
  const rate = c.average_rate_sgd ?? c.base_rate ?? 0
  const availability = (c.availability_status as AvailabilityStatus) || 'available'
  const isBoosted = boostEnabled() && c.boost_active_until && new Date(c.boost_active_until) > new Date()
  const primaryNiche = c.niche ? NICHE_LABELS[c.niche as CreatorNiche] || c.niche : c.niches?.[0]
  const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)

  // Honest, categorical trust indicators (no numeric scores ever).
  const signals = toCreatorSignals(c as any, socials, score)
  const indicators = creatorIndicators(signals, null)

  return (
    <Link
      href={`/creators/${c.slug || c.id}`}
      className="card card-hover"
      style={{ display: 'flex', flexDirection: 'column', padding: 18 }}
    >
      {/* top: avatar + save (if provided) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Avatar src={avatar} name={name} size={46} />
        {saveButton}
      </div>

      {/* name + active badge + availability dot + platform icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 13 }}>
        <span style={{
          fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.01em', color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
        <CreatorActiveBadge claimed={!!c.user_id} onboardingCompleted={!!c.onboarding_completed_at} size={13} />
        <CollabrCertifiedBadge certified={!!c.certified} size="sm" showTip={false} />
        <ConnectedCreatorBadge connected={!!c.connected} showSync={false} />
        {availability === 'available' && (
          <span title="Available" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--money)', flexShrink: 0, marginLeft: 2 }} />
        )}
        {socials.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0, color: 'var(--ink-faint-solid)' }}>
            {socials.slice(0, 4).map(s => {
              const Icon = socialIcon(s.platform)
              return <Icon key={s.id} size={14} aria-label={s.platform} />
            })}
          </span>
        )}
      </div>

      {/* honest trust indicators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
        {indicators.available && <span className="badge badge-accent" style={{ fontSize: 10.5 }}>Available Now</span>}
        {indicators.isNew && <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>New Creator</span>}
      </div>

      {/* handle · niche */}
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {primary ? socialHandleLabel(primary.platform as SocialPlatform, primary.handle) : c.location || 'collabr creator'}
        {primaryNiche ? ` · ${primaryNiche}` : ''}
      </div>

      {/* bio */}
      <div style={{
        fontSize: 13, marginTop: 11, color: 'var(--ink-soft)', lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 39,
      }}>
        {c.bio || `${primaryNiche ? primaryNiche + ' creator' : 'Creator'}${c.location ? ` based in ${c.location}` : ''}.`}
      </div>

      {/* followers + rate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <span className="mono-num" title="Self-reported follower count" style={{ fontSize: 13, color: 'var(--ink)' }}>
          {totalFollowers > 0 ? (
            <>
              {totalFollowers.toLocaleString()}
              <span style={{ color: 'var(--ink-faint-solid)' }}> followers (self-reported)</span>
            </>
          ) : (
            <span style={{ color: 'var(--ink-faint-solid)' }}>No socials yet</span>
          )}
        </span>
        <span className="mono-num" style={{ fontSize: 13, color: 'var(--ink)' }}>
          {rate > 0 ? `from ${formatSGD(rate)}` : 'Negotiable'}
        </span>
      </div>

      {/* footer: rating / collabs + availability/boost badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-faint-solid)' }}>
          {indicators.isNew ? (
            'New to collabr'
          ) : indicators.showRating ? (
            <>
              <Star size={11} fill="currentColor" style={{ color: 'var(--warn)' }} /> {signals.ratingAvg} · {indicators.completedCollabs} completed collab{indicators.completedCollabs !== 1 ? 's' : ''}
            </>
          ) : (
            `${indicators.completedCollabs} completed collab${indicators.completedCollabs !== 1 ? 's' : ''}`
          )}
        </span>
        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {isBoosted && <span className="badge badge-accent" style={{ fontSize: 10.5 }} title="Sponsored placement">Boosted</span>}
          <span className={`badge ${availability === 'available' ? 'badge-safe' : availability === 'limited' ? 'badge-warn' : 'badge-neutral'}`} style={{ fontSize: 10.5 }}>
            {AVAILABILITY_LABELS[availability]}
          </span>
        </span>
      </div>
    </Link>
  )
}
