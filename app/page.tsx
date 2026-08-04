import { landingVersion } from '@/lib/flags'
import CurrentLanding from '@/components/landing/CurrentLanding'
import ConciergeLanding from '@/components/landing/ConciergeLanding'

export const revalidate = 300

export default function HomePage() {
  // Logged-in users are redirected to /dashboard by the middleware, so this
  // page stays fully static (prerendered HTML, served from the edge cache).
  return landingVersion() === 'concierge' ? <ConciergeLanding /> : <CurrentLanding />
}
