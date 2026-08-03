import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkRateLimitDurable, clientIpFromHeaders } from '@/lib/rate-limit'
import { runCreatorDiscovery, type DiscoveryParams } from '@/lib/creator-discovery'
import CreatorFilters from '@/components/CreatorFilters'
import CreatorDiscoveryCard from '@/components/CreatorDiscoveryCard'
import EmptyState from '@/components/EmptyState'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'

// Public, unauthenticated creator browsing - the primary acquisition surface
// for a brand who hasn't signed up yet. Deliberately NOT added to
// middleware.ts's PROTECTED_PREFIXES (that list still gates the full-featured
// /creators dashboard for logged-in Plus brands unchanged) and deliberately
// has zero auth/role checks of its own - always the same simple, public view
// regardless of who's looking, so there's nothing here to rewrite later if
// logged-in brands eventually get more actions layered on top.
export async function generateMetadata({ searchParams }: { searchParams: DiscoveryParams }): Promise<Metadata> {
  const niche = searchParams.niche ? NICHE_LABELS[searchParams.niche as CreatorNiche] || searchParams.niche : null
  const title = niche ? `Browse ${niche} creators` : 'Browse creators'
  const description = niche
    ? `Real ${niche.toLowerCase()} creators on Collabr, browsable and searchable with no account needed.`
    : 'Browse real creators on Collabr by niche, platform, and rate, no account needed to look.'
  // Faceted/paginated variants are real pages (worth crawling and linking
  // between), but indexing every filter combination invites thin/duplicate
  // content - only the bare, unfiltered page is indexed.
  const isBareIndex = Object.keys(searchParams).length === 0
  return { title, description, robots: { index: isBareIndex, follow: true } }
}

export default async function BrowsePage({ searchParams }: { searchParams: DiscoveryParams }) {
  const ip = clientIpFromHeaders(headers())
  const allowed = await checkRateLimitDurable(`browse:${ip}`, 90, 5 * 60 * 1000)
  if (!allowed) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
          Too many requests. Please try again in a few minutes.
        </p>
      </div>
    )
  }

  const supabase = createClient()
  const admin = createAdminClient()
  const { pageCreators, socialsByCreator, scoreById, total, totalPages, page } =
    await runCreatorDiscovery(supabase, admin, searchParams, null)

  function pageHref(p: number) {
    const entries = Object.entries(searchParams).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''
    )
    const next = new URLSearchParams(entries)
    if (p <= 1) next.delete('page')
    else next.set('page', String(p))
    const qs = next.toString()
    return `/browse${qs ? `?${qs}` : ''}`
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="space-y-6">
      <div>
        <h1 className="h1" style={{ fontSize: 24, fontWeight: 600 }}>Browse creators</h1>
        <p style={{ marginTop: 6, fontSize: 14.5, color: 'var(--ink-soft)' }}>
          Real creators on Collabr. Search, filter, and open a profile, no account needed.
        </p>
      </div>

      <Suspense>
        <CreatorFilters showSaved={false} basePath="/browse" />
      </Suspense>

      {total === 0 ? (
        <EmptyState
          icon={Users}
          title="No creators found"
          body="Try broadening your filters or search."
          actionHref="/browse"
          actionLabel="Clear filters"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {pageCreators.map(c => (
            <CreatorDiscoveryCard key={c.id} creator={c} socials={socialsByCreator[c.id] || []} score={scoreById[c.id] || null} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-secondary btn-sm">← Previous</Link>
          ) : (
            <span className="btn-secondary btn-sm" style={{ opacity: 0.4, pointerEvents: 'none' }}>← Previous</span>
          )}
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="btn-secondary btn-sm">Next →</Link>
          ) : (
            <span className="btn-secondary btn-sm" style={{ opacity: 0.4, pointerEvents: 'none' }}>Next →</span>
          )}
        </div>
      )}
    </div>
  )
}
