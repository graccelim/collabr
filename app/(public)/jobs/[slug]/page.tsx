import type { Metadata } from 'next';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser, getUserRow } from '@/lib/auth';
import { isUuid } from '@/lib/slug';
import { ensureCampaignSlug } from '@/lib/slug-server';
import { formatSGD, getInitials } from '@/lib/utils';
import { NICHE_LABELS, INDUSTRY_LABELS, type CreatorNiche, type BrandIndustry } from '@/lib/onboarding';
import { computeFit, bestFollowers } from '@/lib/fit';
import Link from 'next/link';
import { ChevronLeft, Shield, CheckCircle2, Wallet, PenLine, Send, Coins, Star, Briefcase, ArrowRight, Package, Sparkles } from 'lucide-react';
import ApplyForm from '@/components/ApplyForm';
import RatingChip from '@/components/RatingChip';
import AuthGateButton from '@/components/AuthGateButton';

function nicheLabel(tag: string): string {
  return NICHE_LABELS[tag as CreatorNiche] ?? tag;
}

function FitRing({ pct }: { pct: number }) {
  const size = 52,
    sw = 4;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--paper-2)"
          strokeWidth={sw}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--ink)',
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

// SEO: "[Campaign title] by [Brand name] | Collabr". Slug or UUID, same as page.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const { data } = await admin.from('campaigns')
    .select('title, brand_profiles(company_name)').eq(byCol, params.slug).maybeSingle()
  const brandName = (data?.brand_profiles as any)?.company_name || 'a brand'
  const title = data?.title ? `${data.title} by ${brandName} | Collabr` : 'Campaign | Collabr'
  return { title, description: data?.title ? `Apply to "${data.title}" by ${brandName} on Collabr.` : undefined, openGraph: { title }, twitter: { title } }
}

export default async function JobDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  // Public page: open to logged-out visitors. The creator-only bits (fit ring,
  // apply form, application status) render only for a signed-in creator.
  const user = await getAuthUser();
  const supabase = createClient();
  const admin = createAdminClient();
  const viewer = user ? await getUserRow() : null;
  const isCreatorViewer = viewer?.role === 'creator';

  // Campaign is public (admin read so anon + the slug column always resolve).
  // The creator profile only exists for a signed-in creator - fetch it only then.
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const [{ data: campaign }, { data: creator }] = await Promise.all([
    admin
      .from('campaigns')
      .select(
        '*, brand_profiles(id, slug, company_name, company_description, logo_url, website, social_url, industry, completed_campaigns, rating_avg, rating_count)'
      )
      .eq(byCol, params.slug)
      .eq('status', 'active')
      .single(),
    isCreatorViewer && user
      ? supabase
          .from('creator_profiles')
          .select('id, niche, niches')
          .eq('user_id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  if (!campaign)
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-gray-500">
          Campaign not found or no longer active.
        </p>
        <Link href="/jobs" className="text-sm text-purple-600 mt-2 block">
          ← Browse campaigns
        </Link>
      </div>
    );
  const campaignId = campaign.id as string
  const campaignBrand = campaign.brand_profiles as { id?: string; slug?: string | null; company_name?: string | null } | null
  // Backfill a stable slug on first view if missing (side effect) so the public
  // /jobs/[slug] link and metadata resolve later.
  if (!(campaign as { slug?: string | null }).slug) {
    await ensureCampaignSlug(createAdminClient(), campaignId, campaign.title, campaignBrand?.company_name || '')
  }

  // Both depend only on creator.id (+ campaignId) - batch. Guests and brand
  // viewers have no creator profile, so these stay empty for them.
  const [{ data: socials }, { data: existing }, { data: collab }] = creator
    ? await Promise.all([
        supabase
          .from('social_accounts')
          .select('follower_count')
          .eq('creator_id', creator.id),
        // Check if already applied
        supabase
          .from('applications')
          .select('id, status')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creator.id)
          .maybeSingle(),
        // The collab for this campaign+creator (exists once selected) so "View
        // your collab" deep-links to the exact collab, not the list.
        supabase
          .from('collabs')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creator.id)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }];
  const collabHref = collab?.id ? `/collabs/${collab.id}` : '/collabs';

  const brand = campaign.brand_profiles as {
    id?: string;
    slug?: string | null;
    company_name: string | null;
    logo_url: string | null;
    industry?: string | null;
    completed_campaigns?: number | null;
    rating_avg?: number | null;
    rating_count?: number | null;
  } | null;
  const brandName = brand?.company_name || 'Brand';
  const isPaid = campaign.comp_type !== 'barter';
  const platform =
    typeof (campaign as { platform?: unknown }).platform === 'string'
      ? (campaign as { platform: string }).platform
      : null;

  // Real fit for THIS campaign against the signed-in creator.
  const creatorNiches = [
    creator?.niche,
    ...((creator?.niches as string[] | null) ?? []),
  ].filter((n): n is string => Boolean(n));
  const fit = computeFit(
    {
      niches: creatorNiches,
      followers: bestFollowers(
        (socials ?? []) as { follower_count: number | null }[]
      ),
    },
    {
      niches: campaign.niche_tags ?? [],
      minFollowers: campaign.min_followers ?? 0,
    }
  );
  const primaryNiche = creatorNiches[0];
  const fitExplain =
    fit.nicheMatch && primaryNiche
      ? `Your ${nicheLabel(primaryNiche)} niche matches this brief.`
      : fit.followersMet
        ? 'Your reach clears this brief, a clear, specific pitch wins it.'
        : 'A specific pitch about your audience can still win this brief.';

  // Compensation display
  const compValue = !isPaid
    ? 'Barter'
    : campaign.budget_min && campaign.budget_max
      ? `${formatSGD(campaign.budget_min)}–${formatSGD(campaign.budget_max)}`
      : campaign.budget_min
        ? formatSGD(campaign.budget_min)
        : campaign.budget_max
          ? formatSGD(campaign.budget_max)
          : 'Paid';

  const briefMeta: { label: string; value: string }[] = [
    { label: 'Deliverable', value: campaign.deliverable_types?.[0] ?? '-' },
    {
      label: 'Min followers',
      value: campaign.min_followers
        ? `${campaign.min_followers.toLocaleString()}+`
        : 'Any',
    },
    {
      label: 'Due',
      value: campaign.deadline
        ? new Date(campaign.deadline).toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'Flexible',
    },
  ];

  // Compensation reassurance ticks (rail hero) - escrow for paid, product
  // exchange for barter.
  const compTerms: { icon: typeof Shield; t: string; sub: string }[] = isPaid
    ? [
        { icon: Shield, t: 'Funds held securely in escrow', sub: 'The brand funds before you create anything' },
        { icon: CheckCircle2, t: 'Get paid only after approval', sub: 'Release happens automatically on sign-off' },
        { icon: CheckCircle2, t: 'Safe, simple & transparent', sub: 'No invoices, no chasing payment' },
      ]
    : [
        { icon: Package, t: 'Product sent before you post', sub: 'The brand ships what was agreed to start' },
        { icon: CheckCircle2, t: 'Post once you’ve received it', sub: 'Create the agreed content after delivery' },
        { icon: CheckCircle2, t: 'Simple product-for-content swap', sub: 'No payment, no invoices to chase' },
      ];

  // "How it works" - the real flow, which differs for barter (no escrow funding).
  const steps: { icon: typeof Wallet; title: string; body: string }[] = isPaid
    ? [
        { icon: Wallet, title: 'Brand funds escrow', body: 'The brand pays upfront and the money is locked in.' },
        { icon: PenLine, title: 'Create content', body: 'Make the deliverable and submit your draft for review.' },
        { icon: Send, title: 'Submit for approval', body: 'The brand reviews and approves, or requests changes.' },
        { icon: Coins, title: 'Get paid', body: 'Once approved, escrow releases straight to you.' },
      ]
    : [
        { icon: Package, title: 'Brand sends the product', body: 'The agreed item ships to you so you can start.' },
        { icon: PenLine, title: 'Create content', body: 'Make the deliverable and submit your draft for review.' },
        { icon: Send, title: 'Submit for approval', body: 'The brand reviews and approves, or requests changes.' },
        { icon: CheckCircle2, title: 'You’re done', body: 'Post the approved content and the collab wraps up.' },
      ];

  // Brand reputation facts for the rail (only what we actually have - no
  // fabricated response-rate %). Each row: icon, value, label.
  const brandRated = (brand?.rating_count || 0) >= 1;
  const brandStats: { icon: typeof Star; value: string; label: string }[] = [];
  if (brandRated) brandStats.push({ icon: Star, value: String(brand?.rating_avg), label: `Brand rating · ${brand?.rating_count} creator${brand?.rating_count !== 1 ? 's' : ''}` });
  if ((brand?.completed_campaigns || 0) > 0) brandStats.push({ icon: CheckCircle2, value: String(brand?.completed_campaigns), label: `Campaign${brand?.completed_campaigns !== 1 ? 's' : ''} completed` });
  if (brand?.industry) brandStats.push({ icon: Briefcase, value: INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry, label: 'Industry' });

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <Link
        href="/jobs"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          color: 'var(--ink-faint-solid)',
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        <ChevronLeft size={15} /> Browse campaigns
      </Link>

      {/* Brand + title */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--paper-2)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--ink-soft)',
          }}
        >
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brandName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            getInitials(brandName)
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Campaign
          </div>
          <h1 style={{ fontSize: 24, lineHeight: 1.1 }}>{campaign.title}</h1>
          <div
            style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 5 }}
          >
            by{' '}
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {brandName}
            </span>
            {platform ? ` · ${platform}` : ''}
          </div>
          {/* Brand reputation - so creators know who they'd work with. */}
          <div
            style={{
              marginTop: 7,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <RatingChip
              avg={brand?.rating_avg}
              count={brand?.rating_count}
              label="New to collabr"
            />
            {brand?.id && (
              <Link
                href={`/brands/${brand.slug || brand.id}`}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--accent-deep)',
                }}
              >
                View brand profile →
              </Link>
            )}
          </div>
        </div>
      </div>

      <div
        className="pc-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 28,
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            minWidth: 0,
          }}
        >
          {/* The brief - clean white card */}
          <div className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              The brief
            </div>
            <p
              style={{
                color: 'var(--ink)',
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {campaign.brief}
            </p>

            {campaign.barter_detail && (
              <div
                style={{
                  marginTop: 16,
                  padding: 13,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 4 }}>
                  Barter offer
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    color: 'var(--ink-soft)',
                    margin: 0,
                  }}
                >
                  {campaign.barter_detail}
                </p>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${briefMeta.length}, 1fr)`,
                gap: 14,
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid var(--line)',
              }}
            >
              {briefMeta.map((m) => (
                <div key={m.label}>
                  <div className="eyebrow" style={{ fontSize: 10 }}>
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 540,
                      marginTop: 3,
                      color: 'var(--ink)',
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apply or sent state */}
          {existing ? (
            (() => {
              // "shortlisted" is a private brand bookmark - to the creator it reads
              // exactly like a sent application (no false "you're shortlisted" signal).
              const selected = existing.status === 'selected';
              const tint = selected ? 'var(--money-tint)' : 'var(--accent-tint)';
              const solid = selected ? 'var(--money)' : 'var(--accent)';
              const title = selected
                ? 'You were selected!'
                : `Application sent to ${brandName}`;
              const body = selected
                ? isPaid
                  ? 'A collab has been created. Once the brand funds escrow, you can start the draft.'
                  : 'A collab has been created. Once the brand sends the product, you can start the draft.'
                : 'Most brands reply within a few days. You’ll always get a definite answer, by the campaign deadline, or within 14 days.';
              return (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 'var(--radius)',
                    background: tint,
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  {selected ? (
                    <span
                      style={{
                        position: 'relative',
                        width: 46, height: 46,
                        borderRadius: 14,
                        flexShrink: 0,
                        background: 'var(--surface)',
                        color: 'var(--money-deep)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <CheckCircle2 size={24} />
                      <Sparkles size={16} style={{ position: 'absolute', top: -5, right: -5, color: 'var(--money-deep)' }} />
                    </span>
                  ) : (
                    <span
                      style={{
                        width: 42, height: 42,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: solid,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <CheckCircle2 size={22} />
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                      {title}
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {body}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      <Link
                        href={selected ? collabHref : '/applications'}
                        className={selected ? 'btn-money btn-sm' : 'btn-secondary btn-sm'}
                      >
                        {selected ? 'View your collab' : 'Track applications'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : isCreatorViewer && creator ? (
            <ApplyForm
              campaignId={campaignId}
              creatorId={creator.id}
              isPaid={isPaid}
              brandName={brandName}
            />
          ) : viewer?.role === 'brand' ? (
            // A brand viewing a public campaign - applying isn't for them.
            <div className="card" style={{ padding: 18, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              You’re viewing this campaign as a brand. Applications come from creators.
            </div>
          ) : (
            // Logged-out visitor: the Apply action opens the "Sign in to
            // continue" modal (viewing stays open; only the action gates).
            <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Apply for this campaign</div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Create a free creator account to apply, get paid through escrow, and manage your collabs.
                </p>
              </div>
              <AuthGateButton className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                Apply for this campaign
              </AuthGateButton>
            </div>
          )}

          {/* How it works - the real escrow flow */}
          <div id="how-it-works" className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>How it works</div>
            <div className="how-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
              {steps.map((s, i) => (
                <div key={s.title} className="how-step" style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
                      <s.icon size={17} />
                    </span>
                    <span className="mono-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint-solid)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 3, lineHeight: 1.45 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky trust rail */}
        <div
          style={{
            position: 'sticky',
            top: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Compensation hero - the standout navy "wallet" panel */}
          <div className="money-panel" style={{ padding: '22px 22px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--accent-on-dark)' }}>
                Compensation
              </div>
              <div className="mono-num" style={{ fontSize: 27, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                {compValue}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--accent-on-dark)', marginTop: 4 }}>
                {isPaid ? 'Paid in SGD, released on approval' : 'Product or service exchange'}
              </div>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(255,255,255,.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {compTerms.map(({ icon: Icon, t, sub }) => (
                  <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Icon size={15} style={{ color: 'var(--money)', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{t}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--accent-on-dark)', lineHeight: 1.4 }}>{sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Your fit - clean white card. Only meaningful for a signed-in
              creator (real niche/reach signals); hidden for guests and brands. */}
          {isCreatorViewer && creator && (
            <div className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                Your fit for this campaign
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <FitRing pct={fit.pct} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {fitExplain}
                </span>
              </div>
              <Link href="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 14, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)' }}>
                Tips to increase your chances <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Brand reputation - only real facts */}
          {brandStats.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>About the brand</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {brandStats.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--surface-2)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center' }}>
                      <s.icon size={16} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{s.value}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 1 }}>{s.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
