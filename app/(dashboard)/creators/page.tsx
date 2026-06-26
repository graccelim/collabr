import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireBrand } from '@/lib/auth';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatSGD } from '@/lib/utils';
import Avatar from '@/components/Avatar';
import CollabrCertifiedBadge from '@/components/CollabrCertifiedBadge';
import ConnectedCreatorBadge from '@/components/ConnectedCreatorBadge';
import {
  NICHE_LABELS,
  socialHandleLabel,
  type CreatorNiche,
  type SocialPlatform,
} from '@/lib/onboarding';
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles';
import CreatorFilters from '@/components/CreatorFilters';
import SaveCreatorButton from '@/components/SaveCreatorButton';
import EmptyState from '@/components/EmptyState';
import { resolvePlan, isBetaFreePro, PLAN_COLUMNS } from '@/lib/plans';
import PlansCTA from '@/components/PlansCTA';
import { Users, Star, Sparkles } from 'lucide-react';
import type { SocialAccount } from '@/types';
import { socialIcon } from '@/components/SocialIcon';
import { rankCreators, creatorIndicators } from '@/lib/recommend';
import { toCreatorSignals, type ScoreRow } from '@/lib/discovery-data';
import { boostEnabled } from '@/lib/stripe';

const PAGE_SIZE = 12;
// Candidate pool we rank in memory before paginating. Comfortably covers beta
// scale; if a filter ever matches more, the top CANDIDATE_CAP by DB order rank.
const CANDIDATE_CAP = 300;

interface Search {
  platform?: string;
  niche?: string;
  followers?: string;
  availability?: string;
  maxRate?: string;
  location?: string;
  saved?: string;
  certified?: string;
  sort?: string;
  page?: string;
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Search;
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
    // Immersive gate: the (blurred) roster you can't reach yet, with the upgrade
    // centered on top — like the Collabr Plus Upgrade design.
    return (
      <div style={{ minHeight: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 12px' }}>
            Discover the right creators for your campaigns
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 22px' }}>
            Search the full roster, filter to your perfect fit, and invite creators directly — instead of waiting to be found.
          </p>
          <PlansCTA beta={isBetaFreePro()} label="Unlock Discovery" />
        </div>
      </div>
    );
  }

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // ── Pre-filters that resolve to creator-id sets ────────────────────────────
  // Platform / followers live on social_accounts: a creator qualifies when at
  // least one (matching) account meets the follower threshold.
  let idFilter: string[] | null = null;

  const minFollowers = parseInt(searchParams.followers || '', 10);
  if (searchParams.platform || minFollowers > 0) {
    let saQuery = supabase.from('social_accounts').select('creator_id');
    if (searchParams.platform)
      saQuery = saQuery.eq('platform', searchParams.platform);
    if (minFollowers > 0) saQuery = saQuery.gte('follower_count', minFollowers);
    const { data: matches } = await saQuery.limit(5000);
    idFilter = Array.from(new Set((matches || []).map((m) => m.creator_id)));
  }

  if (searchParams.saved === '1' && brand) {
    const { data: saved } = await supabase
      .from('saved_creators')
      .select('creator_id')
      .eq('brand_id', brand.id);
    const savedIds = (saved || []).map((s) => s.creator_id);
    idFilter = idFilter
      ? idFilter.filter((id) => savedIds.includes(id))
      : savedIds;
  }

  // ── Main query ──────────────────────────────────────────────────────────────
  // Admin client: creator profiles are public data, but the users join
  // (display name / avatar) is RLS-limited to own-row for session clients.
  let query = admin
    .from('creator_profiles')
    .select(
      'id, slug, user_id, bio, niche, niches, niche_tags, location, average_rate_sgd, availability_status, base_rate, is_verified, certified, connected, insights_last_synced_at, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url)',
      { count: 'exact' }
    );

  if (idFilter) {
    if (idFilter.length === 0) {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // no matches
    } else {
      query = query.in('id', idFilter);
    }
  }
  if (searchParams.niche) query = query.eq('niche', searchParams.niche);
  if (searchParams.certified === '1') query = query.eq('certified', true);
  if (searchParams.availability)
    query = query.eq('availability_status', searchParams.availability);
  if (searchParams.location)
    query = query.ilike('location', `%${searchParams.location}%`);
  const maxRate = parseInt(searchParams.maxRate || '', 10);
  if (maxRate > 0) query = query.lte('average_rate_sgd', maxRate * 100);

  switch (searchParams.sort) {
    case 'rating':
      query = query
        .order('rating_avg', { ascending: false })
        .order('rating_count', { ascending: false });
      break;
    case 'collabs':
      query = query.order('collabs_completed', { ascending: false });
      break;
    case 'rate_low':
      query = query.order('average_rate_sgd', {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case 'rate_high':
      query = query.order('average_rate_sgd', {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default: // most relevant - re-ranked in memory below; DB order is a fallback
      query = query
        .order('boost_active_until', { ascending: false, nullsFirst: false })
        .order('rating_avg', { ascending: false })
        .order('collabs_completed', { ascending: false });
  }

  // Fetch the whole candidate pool (capped), then rank BEFORE paginating so the
  // best matches surface on page 1 - not stranded on a later DB-ordered page.
  const { data: creators } = await query.limit(CANDIDATE_CAP);

  // Socials + internal scores for ALL candidates (ranking needs the full pool).
  const pageIds = (creators || []).map((c) => c.id);
  const socialsByCreator: Record<string, SocialAccount[]> = {};
  const scoreById: Record<string, ScoreRow> = {};
  let savedSet = new Set<string>();
  if (pageIds.length > 0) {
    // Socials, internal scores, and saved-state are independent - fetch concurrently.
    // Explicit columns - verification_code is not client-readable (migration 017).
    const [{ data: socials }, { data: scores }, savedRes] = await Promise.all([
      supabase
        .from('social_accounts')
        .select(
          'id, creator_id, platform, handle, url, follower_count, is_primary, created_at, updated_at'
        )
        .in('creator_id', pageIds)
        .order('is_primary', { ascending: false })
        .order('follower_count', { ascending: false, nullsFirst: false }),
      admin
        .from('creator_scores')
        .select(
          'creator_id, quality_score, reliability_score, response_rate_shrunk, response_rate, invites_concluded'
        )
        .in('creator_id', pageIds),
      brand
        ? admin
            .from('saved_creators')
            .select('creator_id')
            .eq('brand_id', brand.id)
            .in('creator_id', pageIds)
        : Promise.resolve({ data: [] as { creator_id: string }[] }),
    ]);
    for (const s of (socials || []) as SocialAccount[]) {
      (socialsByCreator[s.creator_id] ||= []).push(s);
    }
    for (const sc of (scores || []) as (ScoreRow & { creator_id: string })[]) {
      scoreById[sc.creator_id] = sc;
    }
    if (brand) {
      const { data: saved } = savedRes;
      savedSet = new Set((saved || []).map((s) => s.creator_id));
    }
  }

  // For "Most relevant" (no explicit sort) we re-rank in memory by the
  // recommendation engine. When the brand picks an EXPLICIT sort (Newest,
  // Highest rated, …) we must honour the DB order instead — otherwise the
  // in-memory re-rank silently overrides their choice and the page looks frozen.
  const hasExplicitSort = Boolean(searchParams.sort);
  const rankedCreators = hasExplicitSort
    ? [...(creators || [])]
    : (() => {
        const rankOrder = new Map(
          rankCreators(
            (creators || []).map((c) =>
              toCreatorSignals(
                c as any,
                socialsByCreator[c.id] || [],
                scoreById[c.id] || null
              )
            ),
            null
          ).map((r, i) => [r.creator.id, i])
        );
        return [...(creators || [])].sort(
          (a, b) => (rankOrder.get(a.id) ?? 0) - (rankOrder.get(b.id) ?? 0)
        );
      })();

  // Paginate the ranked list (not the DB page) so page 1 = the best matches.
  const total = rankedCreators.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageCreators = rankedCreators.slice(from, from + PAGE_SIZE);

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

      {!creators || creators.length === 0 ? (
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
          {pageCreators.map((c) => {
            const name = (c.users as any)?.display_name || 'Creator';
            const avatar = (c.users as any)?.avatar_url;
            const socials = socialsByCreator[c.id] || [];
            const primary = socials[0];
            const rate = c.average_rate_sgd ?? c.base_rate;
            const availability =
              (c.availability_status as AvailabilityStatus) || 'available';
            const isBoosted =
              boostEnabled() &&
              c.boost_active_until &&
              new Date(c.boost_active_until) > new Date();
            const primaryNiche = c.niche
              ? NICHE_LABELS[c.niche as CreatorNiche] || c.niche
              : c.niches?.[0];
            const totalFollowers = socials.reduce(
              (sum, s) => sum + (s.follower_count || 0),
              0
            );

            // Honest, categorical trust indicators (no numeric scores ever).
            const signals = toCreatorSignals(
              c as any,
              socials,
              scoreById[c.id] || null
            );
            const indicators = creatorIndicators(signals, null);

            return (
              <Link
                key={c.id}
                href={`/creators/${(c as { slug?: string | null }).slug || c.id}`}
                className="card card-hover"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 18,
                }}
              >
                {/* top: avatar + save */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <Avatar src={avatar} name={name} size={46} />
                  <SaveCreatorButton
                    creatorId={c.id}
                    initialSaved={savedSet.has(c.id)}
                    compact
                  />
                </div>

                {/* name + availability dot + platform icons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 13,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15.5,
                      letterSpacing: '-0.01em',
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <CollabrCertifiedBadge certified={!!(c as any).certified} size="sm" showTip={false} />
                  <ConnectedCreatorBadge connected={!!(c as any).connected} showSync={false} />
                  {availability === 'available' && (
                    <span
                      title="Available"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 99,
                        background: 'var(--money)',
                        flexShrink: 0,
                        marginLeft: 2,
                      }}
                    />
                  )}
                  {socials.length > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginLeft: 'auto',
                        flexShrink: 0,
                        color: 'var(--ink-faint-solid)',
                      }}
                    >
                      {socials.slice(0, 4).map((s) => {
                        const Icon = socialIcon(s.platform);
                        return (
                          <Icon key={s.id} size={14} aria-label={s.platform} />
                        );
                      })}
                    </span>
                  )}
                </div>

                {/* honest trust indicators */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 5,
                    marginTop: 9,
                  }}
                >
                  {indicators.available && (
                    <span
                      className="badge badge-accent"
                      style={{ fontSize: 10.5 }}
                    >
                      Available Now
                    </span>
                  )}
                  {indicators.isNew && (
                    <span
                      className="badge badge-neutral"
                      style={{ fontSize: 10.5 }}
                    >
                      New Creator
                    </span>
                  )}
                </div>

                {/* handle · niche */}
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-faint-solid)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {primary
                    ? socialHandleLabel(
                        primary.platform as SocialPlatform,
                        primary.handle
                      )
                    : c.location || 'collabr creator'}
                  {primaryNiche ? ` · ${primaryNiche}` : ''}
                </div>

                {/* bio */}
                <div
                  style={{
                    fontSize: 13,
                    marginTop: 11,
                    color: 'var(--ink-soft)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 39,
                  }}
                >
                  {c.bio ||
                    `${primaryNiche ? primaryNiche + ' creator' : 'Creator'}${c.location ? ` based in ${c.location}` : ''}.`}
                </div>

                {/* followers + rate */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span
                    className="mono-num"
                    title="Self-reported follower count"
                    style={{ fontSize: 13, color: 'var(--ink)' }}
                  >
                    {totalFollowers > 0 ? (
                      <>
                        {totalFollowers.toLocaleString()}
                        <span style={{ color: 'var(--ink-faint-solid)' }}>
                          {' '}
                          followers (self-reported)
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-faint-solid)' }}>
                        No socials yet
                      </span>
                    )}
                  </span>
                  <span
                    className="mono-num"
                    style={{ fontSize: 13, color: 'var(--ink)' }}
                  >
                    {rate > 0 ? `from ${formatSGD(rate)}` : 'Negotiable'}
                  </span>
                </div>

                {/* footer: rating / collabs + availability/boost badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      color: 'var(--ink-faint-solid)',
                    }}
                  >
                    {indicators.isNew ? (
                      'New to collabr'
                    ) : indicators.showRating ? (
                      <>
                        <Star
                          size={11}
                          fill="currentColor"
                          style={{ color: 'var(--warn)' }}
                        />{' '}
                        {signals.ratingAvg} · {indicators.completedCollabs}{' '}
                        completed collab
                        {indicators.completedCollabs !== 1 ? 's' : ''}
                      </>
                    ) : (
                      `${indicators.completedCollabs} completed collab${indicators.completedCollabs !== 1 ? 's' : ''}`
                    )}
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {isBoosted && (
                      <span
                        className="badge badge-accent"
                        style={{ fontSize: 10.5 }}
                        title="Sponsored placement"
                      >
                        Boosted
                      </span>
                    )}
                    <span
                      className={`badge ${availability === 'available' ? 'badge-safe' : availability === 'limited' ? 'badge-warn' : 'badge-neutral'}`}
                      style={{ fontSize: 10.5 }}
                    >
                      {AVAILABILITY_LABELS[availability]}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
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
