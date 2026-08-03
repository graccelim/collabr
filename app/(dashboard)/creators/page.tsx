import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireBrand } from '@/lib/auth';
import Link from 'next/link';
import { Suspense } from 'react';
import CreatorFilters from '@/components/CreatorFilters';
import SaveCreatorButton from '@/components/SaveCreatorButton';
import EmptyState from '@/components/EmptyState';
import { resolvePlan, isBetaFreePro, PLAN_COLUMNS } from '@/lib/plans';
import PlansShowcase from '@/components/PlansShowcase';
import { Users } from 'lucide-react';
import CreatorDiscoveryCard from '@/components/CreatorDiscoveryCard';
import { runCreatorDiscovery, type DiscoveryParams } from '@/lib/creator-discovery';

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: DiscoveryParams;
}) {
  const user = await requireBrand();
  const supabase = createClient();
  const admin = createAdminClient();

  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await admin
    .from('brand_profiles')
    .select(`id, ${PLAN_COLUMNS}`)
    .eq('user_id', user.id)
    .single();

  // Creator Discovery is a Brand Plus feature. Gated unless the brand has Plus
  // (stays gated even in beta unless BETA_FREE_PLUS is set) — show the Plus upsell
  // so a brand can upgrade right here, even during beta.
  const plan = resolvePlan(brand);
  if (!plan.isPlus) {
    return (
      <PlansShowcase
        beta={isBetaFreePro()}
        heading="Discover the right creators for your campaigns"
        sub="Search the full roster, filter to the right fit, and reach out to creators for every campaign."
        label="Unlock Discovery"
      />
    );
  }

  const { pageCreators, socialsByCreator, scoreById, savedSet, total, totalPages, page } =
    await runCreatorDiscovery(supabase, admin, searchParams, brand?.id || null);

  function pageHref(p: number) {
    const entries = Object.entries(searchParams).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''
    );
    const next = new URLSearchParams(entries);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    const qs = next.toString();
    return `/creators${qs ? `?${qs}` : ''}`;
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="space-y-6">
      {/* header */}
      <div>
        <h1 className="h1" style={{ fontSize: 24, fontWeight: 600 }}>
          Discover creators
        </h1>
        <p style={{ marginTop: 6, fontSize: 14.5, color: 'var(--ink-soft)' }}>
          Discover creators who fit your brand and start building partnerships.
        </p>
      </div>

      <Suspense>
        <CreatorFilters showSaved />
      </Suspense>

      {total === 0 ? (
        <EmptyState
          icon={Users}
          title={
            searchParams.saved === '1'
              ? 'No saved creators yet'
              : 'No creators found yet'
          }
          body={
            searchParams.saved === '1'
              ? 'Tap the bookmark on any creator to build your shortlist for future campaigns.'
              : 'More creators are joining every day. Try broadening your filters or check back soon.'
          }
          actionHref="/creators"
          actionLabel={
            searchParams.saved === '1' ? 'Browse all creators' : 'Clear filters'
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {pageCreators.map((c) => (
            <CreatorDiscoveryCard
              key={c.id}
              creator={c}
              socials={socialsByCreator[c.id] || []}
              score={scoreById[c.id] || null}
              saveButton={<SaveCreatorButton creatorId={c.id} initialSaved={savedSet.has(c.id)} compact />}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingTop: 8,
          }}
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-secondary btn-sm">
              ← Previous
            </Link>
          ) : (
            <span
              className="btn-secondary btn-sm"
              style={{ opacity: 0.4, pointerEvents: 'none' }}
            >
              ← Previous
            </span>
          )}
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="btn-secondary btn-sm">
              Next →
            </Link>
          ) : (
            <span
              className="btn-secondary btn-sm"
              style={{ opacity: 0.4, pointerEvents: 'none' }}
            >
              Next →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
