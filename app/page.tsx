import { landingVersion } from '@/lib/flags'
import CurrentLanding from '@/components/landing/CurrentLanding'
import ConciergeLanding from '@/components/landing/ConciergeLanding'

// The concierge variant fetches a real (small, revalidated) creator preview;
// the current variant fetches nothing. One revalidate window covers both -
// harmless background revalidation on the static current variant, genuinely
// useful freshness on the concierge one.
export const revalidate = 300

export default function HomePage() {
  // Logged-in users are redirected to /dashboard by the middleware, so this
  // page stays fully static (prerendered HTML, served from the edge cache).
  return landingVersion() === 'concierge' ? <ConciergeLanding /> : <CurrentLanding />
}
