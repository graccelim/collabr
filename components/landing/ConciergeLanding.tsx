import { createAdminClient } from '@/lib/supabase/server'
import { runCreatorDiscovery } from '@/lib/creator-discovery'
import LandingTabs from '@/components/landing/LandingTabs'
import BrandLandingContent from '@/components/landing/BrandLandingContent'
import CreatorLandingContent from '@/components/landing/CreatorLandingContent'

const PREVIEW_COUNT = 4

export default async function ConciergeLanding() {
  const admin = createAdminClient()
  // No searchParams here by design - "/" stays a fixed, cacheable fetch (see
  // app/page.tsx's `revalidate`). All search/filter/sort/pagination lives
  // exclusively on /browse now - the landing page only ever shows a small,
  // fixed preview, never the marketplace itself.
  //
  // admin passed for BOTH client slots (not createClient()): the session
  // client transitively calls cookies() via @supabase/ssr, which forces
  // Next.js to treat the whole route as dynamic and defeats the static
  // generation this page is built for. Every row this query touches
  // (creator_profiles, social_accounts) is already meant to be public, so
  // reading it via the service-role client instead costs nothing.
  const { pageCreators, socialsByCreator, scoreById } = await runCreatorDiscovery(admin, admin, {}, null)
  const preview = pageCreators.slice(0, PREVIEW_COUNT)

  return (
    <LandingTabs
      brandContent={<BrandLandingContent preview={preview} socialsByCreator={socialsByCreator} scoreById={scoreById} />}
      creatorContent={<CreatorLandingContent />}
    />
  )
}
