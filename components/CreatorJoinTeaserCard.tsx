import Link from 'next/link'
import CreatorOptOutLink from '@/components/CreatorOptOutLink'

/**
 * Public profile page's sidebar card for an unclaimed profile. Deliberately
 * NOT asking "is this you?" (that's /join's job) and deliberately not firing
 * the claim-request action itself - it's a quiet, open-ended offer for the
 * rare case the actual creator lands on their own profile without having
 * gone through the DM or /join. "Join Collabr" just hands off into /join
 * (pre-filled with this profile's own platform + handle where known), so
 * there's still exactly one place the confirm-and-request flow happens.
 */
export default function CreatorJoinTeaserCard({ creatorId, joinHref }: { creatorId: string; joinHref: string }) {
  return (
    <div className="rail-section">
      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Are you this creator?
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 14 }}>
        Join Collabr to manage this profile, receive collaboration requests and access protected payments.
      </p>
      <Link href={joinHref} className="btn-primary btn-block" style={{ justifyContent: 'center' }}>
        Join Collabr
      </Link>
      <CreatorOptOutLink creatorId={creatorId} />
    </div>
  )
}
