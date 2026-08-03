import { BadgeCheck } from 'lucide-react'

/**
 * A quiet mark that a creator has claimed their profile and finished
 * onboarding - "active on Collabr," nothing more. No text, no tooltip, no
 * claim about identity/follower verification. Computed entirely from
 * existing canonical fields (creator_profiles.user_id, onboarding_completed_at)
 * rather than a stored flag - there is no duplicated "verified" state anywhere.
 */
export default function CreatorActiveBadge({ claimed, onboardingCompleted, size = 14 }: {
  claimed: boolean
  onboardingCompleted: boolean
  size?: number
}) {
  if (!claimed || !onboardingCompleted) return null
  return (
    <BadgeCheck
      size={size}
      aria-label="Active on Collabr"
      style={{ color: 'var(--accent)', flexShrink: 0 }}
    />
  )
}
