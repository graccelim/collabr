import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAuthUser, getUserRow } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD, getInitials } from '@/lib/utils';
import { deriveWorkflow, actorLabel } from '@/lib/workflow';
import { brandCompletion } from '@/lib/profile-completion';
import { rankCampaignsForCreator } from '@/lib/recommend';
import { toCreatorSignals, toCampaignForCreator } from '@/lib/discovery-data';
import { capacityBreakdown } from '@/lib/collab-status';
import EmptyState from '@/components/EmptyState';
import ProfileCompletion from '@/components/ProfileCompletion';
import CreatorProCTA from '@/components/CreatorProCTA';
import { isProActive } from '@/lib/entitlements';
import { flags } from '@/lib/flags';
import BrandActivation from '@/components/BrandActivation';
import {
  ArrowRight,
  Megaphone,
  Compass,
  Mail,
  Send,
  Check,
  Zap,
  BarChart3,
  UserRound,
  Users,
} from 'lucide-react';

// Calm, single-column dashboards (Collabr Redesign): one dark money anchor,
// one attention row, a quiet hairline list, a profile-completion nudge.

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function MoneyPanel({
  label,
  amount,
  sub,
}: {
  label: string;
  amount: number;
  sub: string;
}) {
  return (
    <div className="money-panel">
      <div className="money-label">{label}</div>
      <div className="money-value">{formatSGD(amount)}</div>
      <div className="money-sub">{sub}</div>
    </div>
  );
}

function AttentionRow({
  href,
  text,
  strong,
}: {
  href: string;
  text: string;
  strong: string;
}) {
  return (
    <Link
      href={href}
      style={{
        width: '100%',
        textDecoration: 'none',
        // Warm pastel orange = "action needed" (friendlier than the dull amber).
        background: '#FFF2E8',
        border: '1px solid rgba(232,140,54,.30)',
        borderRadius: 'var(--radius)',
        padding: '15px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
      }}
    >
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: '#F08A35',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>
          <strong style={{ fontWeight: 560 }}>{strong}</strong> {text}
        </span>
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: '#B45712',
          fontSize: 13.5,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        Review <ArrowRight size={15} />
      </span>
    </Link>
  );
}

function QuietRow({
  href,
  name,
  sub,
  status,
  statusColor,
  amount,
}: {
  href: string;
  name: string;
  sub: string;
  status: string;
  statusColor: string;
  amount: number;
}) {
  return (
    <Link
      href={href}
      className="quiet-row"
      style={{
        width: '100%',
        textDecoration: 'none',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              'linear-gradient(140deg, var(--accent-tint), color-mix(in srgb, var(--accent) 16%, #fff))',
            color: 'var(--accent-deep)',
            boxShadow: 'inset 0 0 0 1px var(--line)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 13.5,
          }}
        >
          {getInitials(name)}
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 14.5,
              fontWeight: 560,
              color: 'var(--ink)',
            }}
          >
            {name}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              color: 'var(--ink-faint-solid)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sub}
          </span>
        </span>
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color:
              statusColor === 'var(--warn)'
                ? 'var(--warn-deep)'
                : 'var(--ink-soft)',
            background:
              statusColor === 'var(--warn)'
                ? 'var(--warn-tint)'
                : 'var(--surface-2)',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              flexShrink: 0,
              background:
                statusColor === 'var(--warn)'
                  ? 'var(--warn)'
                  : 'var(--ink-faint-solid)',
            }}
          />
          {status}
        </span>
        <span
          className="mono-num"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {formatSGD(amount)}
        </span>
      </span>
    </Link>
  );
}

function CompletionNudge({
  href,
  label,
  done,
  total,
}: {
  href: string;
  label: string;
  done: number;
  total: number;
}) {
  if (done >= total) return null;
  const pct = (done / total) * 100;
  return (
    <Link
      href={href}
      style={{
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 'var(--radius)',
        background: 'var(--accent-tint)',
        border: '1px solid var(--accent-tint-2)',
        color: 'var(--accent-deep)',
        fontSize: 13.5,
        fontWeight: 540,
        textDecoration: 'none',
        transition: 'filter .15s ease',
      }}
    >
      <svg
        width={22}
        height={22}
        style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      >
        <circle
          cx={11}
          cy={11}
          r={9}
          fill="none"
          stroke="var(--surface)"
          strokeWidth={3}
        />
        <circle
          cx={11}
          cy={11}
          r={9}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 9}
          strokeDashoffset={2 * Math.PI * 9 * (1 - pct / 100)}
        />
      </svg>
      <span style={{ flex: 1 }}>
        {label}, {done} of {total} steps
      </span>
      <ArrowRight size={16} />
    </Link>
  );
}

export default async function DashboardPage() {
  // Memoized - reuses the layout's getUser + profile read (no extra round-trips).
  const user = await getAuthUser();
  if (!user) redirect('/login');
  const profile = await getUserRow();
  if (!profile) redirect('/signup');

  if (profile.role === 'brand') return <BrandDashboard userId={user.id} />;
  if (profile.role === 'creator')
    return (
      <CreatorDashboard
        userId={user.id}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />
    );
  return <div style={{ color: 'var(--ink-soft)' }}>Loading…</div>;
}

/* ───────────────────────── Brand ───────────────────────── */
async function BrandDashboard({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select(
      'id, user_id, company_name, company_description, industry, website, social_url, logo_url, created_at, rating_avg, rating_count, completed_campaigns'
    )
    .eq('user_id', userId)
    .single();
  if (!brand)
    return (
      <EmptyState
        icon={Megaphone}
        title="Complete your brand profile to get started"
        body="Tell creators who you are, then post your first campaign."
        actionHref="/settings"
        actionLabel="Complete profile"
      />
    );

  // Independent reads - run concurrently. Admin client: creator display
  // identity is RLS own-row-only for session clients; scoped to this brand.
  const admin = createAdminClient();
  const [{ data: campaigns }, { data: collabs }, { data: activeCampaigns }, { data: spotCollabs }] = await Promise.all([
    supabase.from('campaigns').select('id, status').eq('brand_id', brand.id),
    admin
      .from('collabs')
      .select('*, campaigns(title), creator_profiles(users(display_name))')
      .eq('brand_id', brand.id)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('campaigns').select('id, title, creators_needed').eq('brand_id', brand.id).eq('status', 'active'),
    admin.from('collabs').select('campaign_id, status, payment_status').eq('brand_id', brand.id),
  ]);

  // "Choose applicants": active campaigns that still have open spots (funded-
  // aware) AND pending applicants waiting to be reviewed.
  const activeIds = (activeCampaigns || []).map((c) => c.id);
  const { data: pendingApps } = activeIds.length
    ? await admin.from('applications').select('campaign_id').eq('status', 'pending').in('campaign_id', activeIds)
    : { data: [] as { campaign_id: string }[] };
  const pendingByCampaign = new Map<string, number>();
  for (const a of pendingApps || []) pendingByCampaign.set(a.campaign_id, (pendingByCampaign.get(a.campaign_id) || 0) + 1);
  const collabsByCampaign = new Map<string, { status: string; payment_status: string }[]>();
  for (const c of spotCollabs || []) {
    const arr = collabsByCampaign.get(c.campaign_id) ?? [];
    arr.push(c);
    collabsByCampaign.set(c.campaign_id, arr);
  }
  const chooseApplicants = (activeCampaigns || [])
    .map((c) => ({
      id: c.id,
      title: c.title,
      pending: pendingByCampaign.get(c.id) || 0,
      // Reserved (selected-unfunded) slots count as taken — only surface
      // campaigns that genuinely have room for another creator.
      remaining: capacityBreakdown(c.creators_needed ?? 1, collabsByCampaign.get(c.id) ?? []).available,
    }))
    .filter((c) => c.pending > 0 && c.remaining > 0)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 6);

  const pendingReview =
    collabs?.filter((c) => c.status === 'draft_submitted').length || 0;
  const liveToConfirm =
    collabs?.filter((c) => c.status === 'live_submitted').length || 0;
  const escrowed = collabs?.filter((c) => c.payment_status === 'funded') || [];
  const inEscrow = escrowed.reduce((sum, c) => sum + (c.agreed_rate || 0), 0);
  const completion = brandCompletion(brand);

  const statusLine =
    pendingReview > 0
      ? `You have ${pendingReview} draft${pendingReview > 1 ? 's' : ''} to review. Everything else is on track.`
      : liveToConfirm > 0
        ? `${liveToConfirm} live post${liveToConfirm > 1 ? 's are' : ' is'} waiting for your confirmation.`
        : chooseApplicants.length > 0
          ? `You have applicants waiting on ${chooseApplicants.length} campaign${chooseApplicants.length > 1 ? 's' : ''}. Choose who to work with.`
          : 'Everything is on track.';

  const isEmpty =
    (!campaigns || campaigns.length === 0) &&
    (!collabs || collabs.length === 0);

  // Activation checklist: create campaign → invite → fund → receive a draft.
  const { count: inviteCount } = await admin.from('campaign_invites')
    .select('*', { count: 'exact', head: true }).eq('brand_id', brand.id);
  const SECURED = ['funded', 'capture_pending', 'captured', 'transfer_pending', 'paid', 'manual_exception'];
  const activation = {
    hasCampaign: (campaigns?.length ?? 0) > 0,
    hasInvited: (inviteCount ?? 0) > 0,
    hasFunded: (spotCollabs || []).some((c) => SECURED.includes(c.payment_status)),
    hasDraft: (collabs || []).some((c) => c.status !== 'briefed'),
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {!isEmpty && (
        <div style={{ marginTop: 8 }}>
          <BrandActivation {...activation} />
        </div>
      )}
      <div style={{ marginTop: 8, marginBottom: isEmpty ? 28 : 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Brand workspace
        </div>
        <h1
          className="display-face"
          style={{ fontSize: 'clamp(30px, 6vw, 40px)' }}
        >
          {greeting()},{' '}
          <span className="serif-i" style={{ color: 'var(--accent)' }}>
            {brand.company_name}
          </span>
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', marginTop: 10 }}>
          {isEmpty
            ? 'Post your first campaign to start finding creators.'
            : statusLine}
        </p>
      </div>

      <CompletionNudge
        href="/settings"
        label="Finish your brand profile"
        done={completion.items.filter((i) => i.done).length}
        total={completion.items.length}
      />

      <div style={{ marginBottom: 14 }}>
        <MoneyPanel
          label="Protected"
          amount={inEscrow}
          sub={
            inEscrow > 0
              ? `Across ${escrowed.length} collaboration${escrowed.length !== 1 ? 's' : ''} · released only when you approve the work.`
              : 'Nothing secured yet, you’ll secure the payment when you accept your first creator.'
          }
        />
        <Link href={`/brands/${brand.id}`} className="md:hidden"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
          <UserRound size={13} /> View my profile
        </Link>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Megaphone}
          title="Your first collaboration starts here"
          body="Post a campaign, pick a creator you love, and secure the payment, we’ll walk you through every step. It’s free during beta."
          steps={['Post a campaign', 'Pick a creator', 'Secure payment']}
          actionHref="/post-job"
          actionLabel="Post a campaign"
        />
      ) : (
        <>
          {/* the single action */}
          {pendingReview > 0 && (
            <div style={{ marginBottom: liveToConfirm > 0 ? 10 : 48 }}>
              <AttentionRow
                href="/collabs"
                strong={`${pendingReview} draft${pendingReview > 1 ? 's' : ''}`}
                text="waiting for your review"
              />
            </div>
          )}
          {liveToConfirm > 0 && (
            <div style={{ marginBottom: 48 }}>
              <AttentionRow
                href="/collabs"
                strong={`${liveToConfirm} live post${liveToConfirm > 1 ? 's' : ''}`}
                text="ready to confirm and release payment"
              />
            </div>
          )}
          {pendingReview === 0 && liveToConfirm === 0 && (
            <div style={{ marginBottom: 40 }} />
          )}

          {/* Choose applicants - campaigns with open spots + pending applicants */}
          {chooseApplicants.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="eyebrow" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                  <Users size={13} /> Choose applicants
                </span>
                <Link href="/campaigns" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>All campaigns</Link>
              </div>
              <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
                {chooseApplicants.map((c) => (
                  <Link key={c.id} href={`/campaigns/${c.id}`} className="quiet-row"
                    style={{ width: '100%', textDecoration: 'none', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={17} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 560, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                          {c.pending} applicant{c.pending > 1 ? 's' : ''} waiting · {c.remaining} spot{c.remaining > 1 ? 's' : ''} left
                        </span>
                      </span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)', fontSize: 13.5, fontWeight: 530, flexShrink: 0 }}>
                      Review <ArrowRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* active - quiet hairline list */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span
              className="eyebrow"
              style={{
                color: 'var(--money)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: 'var(--money)',
                  flexShrink: 0,
                }}
              />{' '}
              Active collaborations
            </span>
            <Link
              href="/campaigns"
              style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}
            >
              All campaigns
            </Link>
          </div>
          <div
            className="card row-list"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {(collabs || []).length === 0 && (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                No active collaborations yet, they’ll appear here once a creator is confirmed.
              </div>
            )}
            {(collabs || []).map((c) => {
              const name =
                (c.creator_profiles as any)?.users?.display_name || 'Creator';
              const view = deriveWorkflow({
                status: c.status,
                paymentStatus: c.payment_status,
                isBrand: true,
                counterpartName: name,
              });
              const turn = actorLabel(view, true, name);
              return (
                <QuietRow
                  key={c.id}
                  href={`/collabs/${c.id}`}
                  name={name}
                  sub={c.campaigns?.title || 'Campaign'}
                  status={
                    turn.yourTurn
                      ? 'Needs you'
                      : view.actor === 'platform'
                        ? 'Processing'
                        : 'In progress'
                  }
                  statusColor={
                    turn.yourTurn ? 'var(--warn)' : 'var(--ink-faint-solid)'
                  }
                  amount={c.agreed_rate}
                />
              );
            })}
          </div>
        </>
      )}

      {/* What's next - keeps the page useful when there's headroom below. */}
      {!isEmpty && (
        <div style={{ marginTop: 18, padding: '22px 24px', background: 'linear-gradient(135deg, var(--accent-tint-2), var(--accent-tint))', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Ready for more reach?</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '3px 0 0' }}>Post your next campaign or find creators to invite.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/post-job" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Megaphone size={15} /> Post a campaign</Link>
            <Link href="/creators" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Users size={15} /> Discover creators</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Creator ───────────────────────── */
async function CreatorDashboard({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const supabase = createClient();
  const { data: creator } = await supabase
    .from('creator_profiles')
    .select(
      'id, user_id, bio, niche, niches, niche_tags, location, portfolio_links, base_rate, average_rate_sgd, availability_status, boost_active_until, rating_avg, rating_count, collabs_completed'
    )
    .eq('user_id', userId)
    .single();
  if (!creator)
    return (
      <EmptyState
        icon={Compass}
        title="Complete your creator profile to get started"
        body="Add your niche and socials so brands can find you."
        actionHref="/profile"
        actionLabel="Complete profile"
      />
    );

  // Everything below depends only on the creator id (or user id), not on each
  // other - fetch concurrently instead of in a 5-deep waterfall. Admin client
  // for the connect id (RLS hides it from session clients).
  const [
    { data: collabs },
    { data: socials },
    { data: connectProfile },
    { data: invites },
    { data: openApps },
    { data: openCampaigns },
    { data: scoreRow },
  ] = await Promise.all([
    supabase
      .from('collabs')
      .select('*, campaigns(title), brand_profiles(company_name)')
      .eq('creator_id', creator.id)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('social_accounts')
      .select('follower_count')
      .eq('creator_id', creator.id),
    createAdminClient()
      .from('creator_profiles')
      .select('stripe_connect_id, total_earned')
      .eq('id', creator.id)
      .single(),
    supabase
      .from('campaign_invites')
      .select('id, created_at, campaigns(title), brand_profiles(company_name)')
      .eq('creator_id', creator.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('applications')
      .select('id, campaign_id, status')
      .eq('creator_id', creator.id)
      .neq('status', 'rejected'),
    supabase
      .from('campaigns')
      .select(
        'id, title, comp_type, budget_min, budget_max, niche_tags, min_followers, is_featured, created_at, brand_profiles(company_name, completed_campaigns)'
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('creator_scores')
      .select('*')
      .eq('creator_id', creator.id)
      .maybeSingle(),
  ]);

  const socialsCount = socials?.length || 0;
  const needsPayoutSetup = !connectProfile?.stripe_connect_id;
  const appliedCampaignIds = new Set(
    (openApps || []).map((a) => a.campaign_id)
  );
  const outboundCount = (openApps || []).length;

  // "Matched to you": up to 3 active campaigns the creator hasn't applied to,
  // ranked by the two-sided recommender. Shows an honest tier label + reasons -
  // never a percentage or numeric score.
  const creatorSignals = toCreatorSignals(
    creator,
    (socials || []) as { follower_count: number | null }[],
    scoreRow
  );
  const unappliedCampaigns = (openCampaigns || []).filter(
    (c) => !appliedCampaignIds.has(c.id)
  );
  const campaignById = new Map(unappliedCampaigns.map((c) => [c.id, c]));
  const matched = rankCampaignsForCreator(
    creatorSignals,
    unappliedCampaigns.map((c) => {
      const brand = (c.brand_profiles as any) ?? null;
      return toCampaignForCreator(c, brand?.completed_campaigns ?? 0);
    })
  )
    .slice(0, 3)
    .map((r) => {
      const c = campaignById.get(r.campaign.id)!;
      const hasPay = c.comp_type === 'paid' || c.comp_type === 'both';
      const pay = hasPay
        ? c.budget_min
          ? `${formatSGD(c.budget_min)}${c.budget_max ? ` to ${formatSGD(c.budget_max)}` : ''}`
          : 'Paid'
        : 'Barter';
      return {
        id: c.id,
        title: c.title,
        brand: (c.brand_profiles as any)?.company_name || 'A brand',
        pay,
        label: r.label,
        // Keep it tight on the dashboard - 1–2 reasons.
        reasons: r.reasons.slice(0, 2),
      };
    });

  const happeningEmpty = (invites || []).length === 0 && outboundCount === 0;

  const needsYou = (collabs || []).filter((c) => {
    const v = deriveWorkflow({
      status: c.status,
      paymentStatus: c.payment_status,
      isBrand: false,
      counterpartName: 'Brand',
    });
    return actorLabel(v, false, 'Brand').yourTurn;
  });
  const securedNow = (collabs || [])
    .filter((c) => c.payment_status === 'funded')
    .reduce((sum, c) => sum + (c.creator_payout || 0), 0);
  const isBoosted =
    creator.boost_active_until &&
    new Date(creator.boost_active_until) > new Date();
  const isEmpty = !collabs || collabs.length === 0;

  // Entice non-Pro creators to upgrade (card self-hides when the flag is off).
  const { data: proSub } = await createAdminClient()
    .from('creator_subscriptions').select('status, pro_until').eq('creator_id', creator.id).maybeSingle();
  const showUpgrade = !isProActive(proSub ?? null);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Creator Studio entrance. DESKTOP keeps the upsell card (sidebar has the
          Studio nav). MOBILE gets a single top entrance: not subscribed → a link
          into the gated Studio page; subscribed → a slim, premium Studio button. */}
      {showUpgrade && (
        <div className="hidden md:block" style={{ marginTop: 8, marginBottom: 18 }}>
          <CreatorProCTA returnTo="/studio" />
        </div>
      )}
      {/* MOBILE not-subscribed: link into the gated Studio. Subscribed creators get
          the Studio CTA in the top bar instead (no button here). */}
      {flags.creatorStudio && showUpgrade && (
        <div className="md:hidden" style={{ marginTop: 8, marginBottom: 16 }}>
          <Link href="/studio" style={{
            width: '100%', textAlign: 'left', textDecoration: 'none', borderRadius: 'var(--radius)',
            padding: '13px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(100deg, #232c57 0%, #0e1538 60%, #05081c 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'rgba(91,83,224,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={16} color="#fff" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Unlock your analytics with Creator Pro</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>See what is working and win more brand deals.</span>
            </span>
            <ArrowRight size={18} style={{ flexShrink: 0, opacity: .85 }} />
          </Link>
        </div>
      )}

      {/* Greeting, always at the top of the page content. */}
      <div style={{ marginTop: 8, marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Creator studio
        </div>
        <h1
          className="display-face"
          style={{ fontSize: 'clamp(30px, 6vw, 40px)' }}
        >
          {greeting()}
          {displayName ? (
            <>
              ,{' '}
              <span className="serif-i" style={{ color: 'var(--accent)' }}>
                {displayName.split(' ')[0]}
              </span>
            </>
          ) : (
            ''
          )}
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', marginTop: 10 }}>
          {isEmpty
            ? 'Browse campaigns and land your first paid collab.'
            : needsYou.length > 0
              ? `${needsYou.length} collab${needsYou.length > 1 ? 's need' : ' needs'} your attention.`
              : 'Everything is on track.'}
          {isBoosted ? ' Boost is active, you appear first to brands.' : ''}
        </p>
      </div>

      {/* Single onboarding-progress surface (the "Welcome to Collabr" checklist),
          below the greeting. The old "Finish your profile, N of M" nudge was a
          duplicate with a different count, so it's removed. */}
      <div style={{ marginBottom: isEmpty ? 28 : 18 }}>
        <ProfileCompletion
          hasPhoto={Boolean(avatarUrl)}
          hasBio={Boolean(creator.bio)}
          hasNiche={(creator.niche_tags?.length ?? 0) > 0}
          hasRates={Boolean(creator.base_rate || creator.average_rate_sgd)}
          hasExtraSocials={(socials?.length ?? 0) > 1}
        />
      </div>

      {/* earnings - the one dark anchor */}
      <div className="money-panel" style={{ marginBottom: 14 }}>
        <div
          className="money-rows"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="money-label">Total earned</div>
            <div className="money-value">
              {formatSGD(connectProfile?.total_earned || 0)}
            </div>
          </div>
          <div className="money-secured" style={{ textAlign: 'right' }}>
            <div className="money-label">Protected now</div>
            <div
              className="mono-num"
              style={{
                fontSize: 22,
                fontWeight: 560,
                marginTop: 10,
                color: securedNow > 0 ? '#6FCFB2' : 'rgba(255,255,255,.55)',
              }}
            >
              {formatSGD(securedNow)}
            </div>
          </div>
        </div>
        <div className="money-sub">
          {creator.collabs_completed || 0} collab
          {creator.collabs_completed !== 1 ? 's' : ''} completed
          {creator.rating_count > 0
            ? ` · ${creator.rating_avg} ★ average rating`
            : ''}
          {securedNow > 0
            ? ' · protected funds release when your work is approved.'
            : ''}
        </div>
      </div>

      {/* Connect-your-payout nudge - sits directly under the earnings card */}
      {needsPayoutSetup && (
        <Link
          href="/earnings"
          style={{
            width: '100%',
            textDecoration: 'none',
            marginBottom: 14,
            background: 'var(--accent-tint)',
            border: '1px solid var(--accent-tint-2)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: 'var(--accent)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>
              Connect your payout account so the money can reach you
            </span>
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--ink-soft)',
              fontSize: 13.5,
              fontWeight: 530,
              flexShrink: 0,
            }}
          >
            Set up <ArrowRight size={15} />
          </span>
        </Link>
      )}

      {/* Mobile "view my profile" (Creator Studio entrance now lives at the top). */}
      <Link href={`/creators/${creator.id}`} className="md:hidden"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 12.5, color: 'var(--ink-faint-solid)', textDecoration: 'none' }}>
        <UserRound size={13} /> View my profile
      </Link>

      {isEmpty ? (
        <EmptyState
          icon={Compass}
          title="Let's land your first paid collab"
          body="Browse open campaigns that fit your niche, send a pitch, and the brand secures the payment before you create anything."
          steps={[
            'Browse campaigns',
            'Send a pitch',
            'Money secured, you create',
          ]}
          actionHref="/jobs"
          actionLabel="Browse campaigns"
        />
      ) : (
        <>
          {needsYou.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <AttentionRow
                href={`/collabs/${needsYou[0].id}`}
                strong={
                  (needsYou[0].brand_profiles as any)?.company_name || 'A brand'
                }
                text={`is waiting on you, ${deriveWorkflow({ status: needsYou[0].status, paymentStatus: needsYou[0].payment_status, isBrand: false, counterpartName: 'the brand' }).next.split('.')[0].toLowerCase()}`}
              />
            </div>
          )}
          {needsYou.length === 0 && <div style={{ marginBottom: 40 }} />}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span
              className="eyebrow"
              style={{
                color: 'var(--money)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: 'var(--money)',
                  flexShrink: 0,
                }}
              />{' '}
              Active collaborations
            </span>
            <Link
              href="/collabs"
              style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}
            >
              All collabs
            </Link>
          </div>
          <div
            className="card row-list"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {(collabs || []).length === 0 && (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                No active collaborations yet, they’ll appear here once one is underway.
              </div>
            )}
            {(collabs || []).map((c) => {
              const name = (c.brand_profiles as any)?.company_name || 'Brand';
              const view = deriveWorkflow({
                status: c.status,
                paymentStatus: c.payment_status,
                isBrand: false,
                counterpartName: name,
              });
              const turn = actorLabel(view, false, name);
              return (
                <QuietRow
                  key={c.id}
                  href={`/collabs/${c.id}`}
                  name={name}
                  sub={c.campaigns?.title || 'Campaign'}
                  status={
                    turn.yourTurn
                      ? 'Action needed'
                      : view.actor === 'platform'
                        ? 'Processing'
                        : 'Waiting on brand'
                  }
                  statusColor={
                    turn.yourTurn ? 'var(--warn)' : 'var(--ink-faint-solid)'
                  }
                  amount={c.creator_payout}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Happening now - real pending invites + outbound application count */}
      {!happeningEmpty && (
        <div style={{ marginTop: isEmpty ? 40 : 48, marginBottom: 8 }}>
          <span
            className="eyebrow"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 12,
              color: 'var(--warn)',
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <Zap size={13} /> Happening now
          </span>
          <div
            className="card row-list"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {(invites || []).map((inv) => {
              const company =
                (inv.brand_profiles as any)?.company_name || 'A brand';
              const campaignTitle =
                (inv.campaigns as any)?.title || 'a campaign';
              return (
                <Link
                  key={inv.id}
                  href="/invites"
                  className="quiet-row"
                  style={{
                    width: '100%',
                    textDecoration: 'none',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-sm)',
                        flexShrink: 0,
                        background: 'var(--warn-tint)',
                        color: 'var(--warn)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Mail size={17} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 14.5,
                          fontWeight: 560,
                          color: 'var(--ink)',
                        }}
                      >
                        {company} invited you
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          color: 'var(--ink-faint-solid)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {campaignTitle}
                      </span>
                    </span>
                  </span>
                  <span className="badge badge-warn" style={{ flexShrink: 0 }}>
                    New invite
                  </span>
                </Link>
              );
            })}
            {outboundCount > 0 && (
              <Link
                href="/applications"
                className="quiet-row"
                style={{
                  width: '100%',
                  textDecoration: 'none',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                      background: 'var(--money-tint)',
                      color: 'var(--money)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={16} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14.5,
                        fontWeight: 560,
                        color: 'var(--ink)',
                      }}
                    >
                      {outboundCount} application{outboundCount > 1 ? 's' : ''}{' '}
                      out
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13,
                        color: 'var(--ink-faint-solid)',
                      }}
                    >
                      Awaiting reply
                    </span>
                  </span>
                </span>
                <span className="badge badge-money" style={{ flexShrink: 0 }}>
                  Active
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Matched to you - active campaigns ranked by the two-sided recommender;
          honest tier label + 1 to 2 reasons, never a percentage */}
      {matched.length > 0 && (
        <div
          style={{
            marginTop: happeningEmpty ? (isEmpty ? 40 : 48) : 40,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span
              className="eyebrow"
              style={{
                color: 'var(--match)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              Matched to you
            </span>
            <Link
              href="/jobs"
              style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}
            >
              Browse all
            </Link>
          </div>
          <div
            className="card row-list"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {matched.map((m) => (
              <Link
                key={m.id}
                href={`/jobs/${m.id}`}
                className="quiet-row"
                style={{
                  width: '100%',
                  textDecoration: 'none',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                      background:
                        'linear-gradient(140deg, var(--accent-tint), color-mix(in srgb, var(--accent) 16%, #fff))',
                      color: 'var(--accent-deep)',
                      boxShadow: 'inset 0 0 0 1px var(--line)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    {getInitials(m.brand)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14.5,
                        fontWeight: 560,
                        color: 'var(--ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.title}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13,
                        color: 'var(--ink-faint-solid)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.brand} · <span className="mono-num">{m.pay}</span>
                    </span>
                    {m.reasons.length > 0 && (
                      <span
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 10,
                          marginTop: 5,
                        }}
                      >
                        {m.reasons.map((reason) => (
                          <span
                            key={reason}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: 'var(--ink-soft)',
                            }}
                          >
                            <Check
                              size={12}
                              style={{
                                color: 'var(--match)',
                                flexShrink: 0,
                              }}
                            />
                            {reason}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </span>
                {/* Honest tier label - only when there's a credible fit. */}
                {m.label && (
                  <span
                    className="badge badge-match"
                    style={{ flexShrink: 0, gap: 4 }}
                  >
                    {m.label}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* What's next - nudge to keep browsing when there's headroom below. */}
      {!isEmpty && (
        <div style={{ marginTop: 18, padding: '22px 24px', background: 'linear-gradient(135deg, var(--accent-tint-2), var(--accent-tint))', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Find your next collab</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '3px 0 0' }}>Fresh campaigns drop daily, see what fits you now.</p>
          </div>
          <Link href="/jobs" className="btn-primary" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}><Compass size={15} /> Discover campaigns</Link>
        </div>
      )}
    </div>
  );
}
