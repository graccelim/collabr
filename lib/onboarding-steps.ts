// Onboarding checklist derivation (signup-flow redesign, 2026-07).
//
// Signup now collects only role + name + email + password; everything else
// moves into an in-product checklist shown on the dashboard until the
// activation gate (`onboarding_completed_at`) is set. Steps are DERIVED from
// real profile data — never tracked separately — so progress persists, resumes
// across devices, and can't drift from what the user actually did. Existing
// accounts (old flow set onboarding_completed_at at signup) derive as complete
// and never see the checklist.

export interface OnboardingStep {
  key: string
  label: string
  /** Why this step is worth doing — payoff, not chore. */
  detail?: string
  done: boolean
  href?: string
  cta?: string
}

export interface StepsSummary {
  steps: OnboardingStep[]
  done: number
  total: number
  /** First not-done step — the one the checklist spotlights. */
  current: OnboardingStep | null
  /** The activation gate is open (can transact) — a STATE, not a step: it can
   *  be true while later polish steps are pending, so rendering it as a row
   *  would look like an out-of-order tick. Shown as a status banner instead. */
  ready: boolean
}

function summarize(steps: OnboardingStep[], ready: boolean): StepsSummary {
  const done = steps.filter(s => s.done).length
  return { steps, done, total: steps.length, current: steps.find(s => !s.done) ?? null, ready }
}

/**
 * Creator path. The only HARD gate is one social profile (that's what flips
 * onboarding_completed_at via /api/onboarding/creator) — niches and profile
 * polish improve matching but never block applying.
 */
export function creatorOnboardingSteps(d: {
  socialsCount: number
  nicheCount: number
  hasPhoto: boolean
  hasBio: boolean
  hasRates: boolean
  hasPayout: boolean
}): StepsSummary {
  const socialsDone = d.socialsCount > 0
  return summarize([
    { key: 'account', label: 'Account created', done: true },
    {
      key: 'socials',
      label: 'Add a social profile',
      detail: 'Brands open your socials before selecting anyone — one profile takes you live.',
      done: socialsDone,
      href: '/onboarding',
      cta: 'Add your socials',
    },
    {
      key: 'niches',
      label: 'Pick your niches',
      detail: 'Matches you to the right campaigns and turns on email alerts for new ones in your niche.',
      done: d.nicheCount > 0,
      // Both live on the /onboarding form until it's submitted; afterwards
      // that page redirects to the dashboard, so edits move to the profile.
      href: socialsDone ? '/profile' : '/onboarding',
      cta: 'Pick niches',
    },
    {
      key: 'profile',
      label: 'Add a photo and short bio',
      detail: 'Profiles with a face and a story get shortlisted far more often.',
      done: d.hasPhoto && d.hasBio,
      href: '/profile',
      cta: 'Complete profile',
    },
    {
      key: 'rates',
      label: 'Set your rates',
      detail: 'Brands filter by budget — a rate helps the right ones find you.',
      done: d.hasRates,
      href: '/profile',
      cta: 'Set rates',
    },
    {
      key: 'payout',
      label: 'Connect your payout account',
      detail: 'Payments release the moment your work is approved — this is where they land.',
      done: d.hasPayout,
      href: '/earnings',
      cta: 'Set up payouts',
    },
  ], socialsDone)
}

/**
 * Brand path. The HARD gate is company basics (industry + website-or-social,
 * set via /api/onboarding/brand → onboarding_completed_at); posting the first
 * campaign is the activation event the checklist drives toward.
 */
export function brandOnboardingSteps(d: {
  companyBasicsDone: boolean
  hasLogo: boolean
  hasDescription: boolean
  campaignCount: number
}): StepsSummary {
  return summarize([
    { key: 'account', label: 'Account created', done: true },
    {
      key: 'company',
      label: 'Tell creators about your company',
      detail: 'Industry plus a website or social — creators check this before they apply.',
      done: d.companyBasicsDone,
      href: '/onboarding',
      cta: 'Add company details',
    },
    {
      key: 'brand',
      label: 'Add your logo and description',
      detail: 'Campaigns from complete brand profiles attract noticeably more applicants.',
      done: d.hasLogo && d.hasDescription,
      href: '/settings',
      cta: 'Polish your profile',
    },
    {
      key: 'campaign',
      label: 'Post your first campaign',
      detail: 'About 5 minutes — most campaigns get their first applications within 48 hours.',
      done: d.campaignCount > 0,
      href: '/post-job',
      cta: 'Post a campaign',
    },
  ], d.companyBasicsDone && d.campaignCount > 0)
}
