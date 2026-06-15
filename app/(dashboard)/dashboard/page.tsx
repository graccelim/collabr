import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAuthUser, getUserRow } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD, getInitials } from '@/lib/utils';
import { deriveWorkflow, actorLabel } from '@/lib/workflow';
import { brandCompletion, creatorCompletion } from '@/lib/profile-completion';
import { rankCampaignsForCreator } from '@/lib/recommend';
import { toCreatorSignals, toCampaignForCreator } from '@/lib/discovery-data';
import EmptyState from '@/components/EmptyState';
import {
  ArrowRight,
  Megaphone,
  Compass,
  Mail,
  Send,
  Sparkles,
  Check,
  Zap,
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
        background: 'linear-gradient(100deg, var(--warn-tint) 0%, var(--surface) 32%)',
        border: '1px solid var(--line)',
        borderLeft: '3px solid var(--warn)',
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
            background: 'var(--warn)',
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
          color: 'var(--ink-soft)',
          fontSize: 13.5,
          fontWeight: 530,
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
        borderLeft: '3px solid var(--accent)',
        background: 'linear-gradient(100deg, var(--accent-tint) 0%, transparent 34%)',
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
            fontSize: 12,
            fontWeight: 600,
            color: statusColor,
            background:
              statusColor === 'var(--warn)'
                ? 'var(--warn-tint)'
                : 'var(--surface-2)',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
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
        {label} — {done} of {total} steps
      </span>
      <ArrowRight size={16} />
    </Link>
  );
}

export default async function DashboardPage() {
  // Memoized — reuses the layout's getUser + profile read (no extra round-trips).
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

  // Independent reads — run concurrently. Admin client: creator display
  // identity is RLS own-row-only for session clients; scoped to this brand.
  const [{ data: campaigns }, { data: collabs }] = await Promise.all([
    supabase.from('campaigns').select('id, status').eq('brand_id', brand.id),
    createAdminClient()
      .from('collabs')
      .select('*, campaigns(title), creator_profiles(users(display_name))')
      .eq('brand_id', brand.id)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

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
        : 'Everything is on track.';

  const isEmpty =
    (!campaigns || campaigns.length === 0) &&
    (!collabs || collabs.length === 0);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
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
          label="Held in escrow"
          amount={inEscrow}
          sub={
            inEscrow > 0
              ? `Across ${escrowed.length} collaboration${escrowed.length !== 1 ? 's' : ''} · released only when you approve the work.`
              : 'Nothing secured yet — you’ll fund escrow when you accept your first creator.'
          }
        />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Megaphone}
          title="Your first collaboration starts here"
          body="Post a campaign, pick a creator you love, and fund escrow — we’ll walk you through every step. It’s free during beta."
          steps={['Post a campaign', 'Pick a creator', 'Fund escrow']}
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

          {/* active — quiet hairline list */}
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
  // other — fetch concurrently instead of in a 5-deep waterfall. Admin client
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
      .select('follower_count, verification_status')
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
  // ranked by the two-sided recommender. Shows an honest tier label + reasons —
  // never a percentage or numeric score.
  const creatorSignals = toCreatorSignals(
    creator,
    (socials || []) as {
      follower_count: number | null;
      verification_status: string | null;
    }[],
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
          ? `${formatSGD(c.budget_min)}${c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}`
          : 'Paid'
        : 'Barter';
      return {
        id: c.id,
        title: c.title,
        brand: (c.brand_profiles as any)?.company_name || 'A brand',
        pay,
        label: r.label,
        // Keep it tight on the dashboard — 1–2 reasons.
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
  const completion = creatorCompletion({
    ...creator,
    avatar_url: avatarUrl,
    socials_count: socialsCount || 0,
  });
  const isBoosted =
    creator.boost_active_until &&
    new Date(creator.boost_active_until) > new Date();
  const isEmpty = !collabs || collabs.length === 0;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginTop: 8, marginBottom: isEmpty ? 28 : 18 }}>
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
              ? `${needsYou.length} collab${needsYou.length > 1 ? 's need' : ' needs'} your next move.`
              : 'Everything is on track.'}
          {isBoosted ? ' Boost is active — you appear first to brands.' : ''}
        </p>
      </div>

      <CompletionNudge
        href="/profile"
        label="Finish your profile"
        done={completion.items.filter((i) => i.done).length}
        total={completion.items.length}
      />

      {/* Connect-your-payout nudge — sits with the profile nudge, above earnings */}
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

      {/* earnings — the one dark anchor */}
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
            <div className="money-label">Secured in escrow now</div>
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
            ? ' · escrowed funds release when your work is approved.'
            : ''}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Compass}
          title="Let's land your first paid collab"
          body="Browse open campaigns that fit your niche, send a pitch, and the brand funds escrow before you create anything."
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
                text={`is waiting on you — ${deriveWorkflow({ status: needsYou[0].status, paymentStatus: needsYou[0].payment_status, isBrand: false, counterpartName: 'the brand' }).next.split('.')[0].toLowerCase()}`}
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
                      ? 'Your move'
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

      {/* Happening now — real pending invites + outbound application count */}
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

      {/* Matched to you — active campaigns ranked by the two-sided recommender;
          honest tier label + 1–2 reasons, never a percentage */}
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
              }}
            >
              <Sparkles size={13} /> Matched to you
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
                {/* Honest tier label — only when there's a credible fit. */}
                {m.label && (
                  <span
                    className="badge badge-match"
                    style={{ flexShrink: 0, gap: 4 }}
                  >
                    <Sparkles size={11} /> {m.label}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
