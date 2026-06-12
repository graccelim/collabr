export type UserRole = 'brand' | 'creator' | 'admin'

export type CollabStatus =
  | 'briefed' | 'draft_submitted' | 'in_revision' | 'draft_approved'
  | 'live_submitted' | 'live_confirmed' | 'disputed' | 'completed' | 'cancelled'

export type CompType = 'paid' | 'barter' | 'both'
export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube'
export type SocialVerificationStatus = 'unverified' | 'pending' | 'verified'
export type AvailabilityStatus = 'available' | 'limited' | 'unavailable'
export type DisputeOutcome = 'pending' | 'creator_wins' | 'brand_wins' | 'split' | 'mutual'
export type ApplicationStatus = 'pending' | 'shortlisted' | 'selected' | 'rejected'
export type SubmissionDecision = 'pending' | 'approved' | 'revision' | 'rejected'

export interface User {
  id: string
  role: UserRole
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface BrandProfile {
  id: string
  user_id: string
  company_name: string
  company_description: string | null
  industry: string | null
  website: string | null
  logo_url: string | null
  plan: 'free' | 'pro'
  stripe_customer_id: string | null
  social_url: string | null
  completed_campaigns: number
  onboarding_completed_at: string | null
  created_at: string
}

export interface SocialAccount {
  id: string
  creator_id: string
  platform: SocialPlatform
  handle: string
  url: string
  follower_count: number | null
  verification_status: SocialVerificationStatus
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CreatorProfile {
  id: string
  user_id: string
  bio: string | null
  niche: string | null
  niches: string[] | null
  location: string | null
  portfolio_links: string[]
  media_kit_url: string | null
  average_rate_sgd: number | null // cents, like all monetary values
  availability_status: AvailabilityStatus
  platforms: Record<string, { handle: string; followers: number; verified: boolean }> | null
  base_rate: number
  is_verified: boolean
  boost_active_until: string | null
  rating_avg: number
  rating_count: number
  collabs_completed: number
  total_earned: number
  stripe_connect_id: string | null
  onboarding_completed_at: string | null
  created_at: string
  social_accounts?: SocialAccount[]
}

export interface Campaign {
  id: string
  brand_id: string
  title: string
  brief: string
  deliverable_types: string[] | null
  comp_type: CompType
  budget_min: number | null
  budget_max: number | null
  barter_detail: string | null
  niche_tags: string[] | null
  min_followers: number
  creators_needed: number
  deadline: string | null
  status: 'draft' | 'active' | 'closed' | 'completed'
  is_featured: boolean
  created_at: string
  brand_profiles?: BrandProfile
}

export interface Application {
  id: string
  campaign_id: string
  creator_id: string
  pitch: string
  proposed_rate: number | null
  status: ApplicationStatus
  is_boosted: boolean
  created_at: string
  creator_profiles?: CreatorProfile & { users?: User }
  campaigns?: Campaign
}

export interface Collab {
  id: string
  application_id: string
  campaign_id: string
  creator_id: string
  brand_id: string
  agreed_rate: number
  platform_fee: number
  creator_payout: number
  status: CollabStatus
  revision_count: number
  stripe_payment_intent_id: string | null
  draft_auto_approve_at: string | null
  live_auto_release_at: string | null
  created_at: string
  campaigns?: Campaign
  creator_profiles?: CreatorProfile & { users?: User }
  brand_profiles?: BrandProfile & { users?: User }
}

export interface Submission {
  id: string
  collab_id: string
  version: number
  file_url: string | null
  storage_path: string | null
  external_url: string | null
  creator_note: string | null
  brand_feedback: string | null
  decision: SubmissionDecision
  submitted_at: string
  decided_at: string | null
}

export interface LivePost {
  id: string
  collab_id: string
  post_url: string
  screenshot_url: string | null
  submitted_at: string
  confirmed_at: string | null
  disputed_at: string | null
}

export interface Dispute {
  id: string
  collab_id: string
  raised_by: 'brand' | 'creator'
  reason: string
  evidence_urls: string[] | null
  outcome: DisputeOutcome
  split_percentage: number | null
  platform_ruling: string | null
  resolved_at: string | null
  created_at: string
}

export interface Review {
  id: string
  collab_id: string
  reviewer_id: string
  reviewer_type: 'brand' | 'creator'
  rating: number
  note: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}
