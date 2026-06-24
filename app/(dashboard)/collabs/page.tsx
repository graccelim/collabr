import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAuth, getUserRow } from '@/lib/auth';
import { formatSGD, COLLAB_STATUSES, getInitials } from '@/lib/utils';
import { deriveWorkflow, actorLabel, escrowStep } from '@/lib/workflow';
import { isPaymentSecured } from '@/lib/collab-status';
import EmptyState from '@/components/EmptyState';
import CollabsList, { type CollabRowData } from '@/components/CollabsList';
import InfoTip from '@/components/InfoTip';
import { TERMS } from '@/lib/terms';
import { Briefcase, Compass, Megaphone, Lock, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

/** White stat tile used in the collabs stat band. */
function Stat({
  label,
  value,
  sub,
  subColor,
  icon,
  iconBg,
  className,
}: {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  icon: React.ReactNode;
  iconBg: string;
  className?: string;
}) {
  return (
    <div
      className={`card${className ? ` ${className}` : ''}`}
      style={{ padding: 18 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="eyebrow" style={{ fontSize: 10.5 }}>{label}</span>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
      </div>
      <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: subColor || 'var(--ink-soft)', marginTop: 7, fontWeight: subColor ? 500 : 400 }}>
        {sub}
      </div>
    </div>
  );
}

export default async function CollabsPage() {
  const user = await requireAuth();
  const supabase = createClient();
  const profile = await getUserRow();

  const isBrand = profile?.role === 'brand';

  // Resolve the viewer's own profile id first - the list query below uses the
  // admin client (counterparty display identity is RLS own-row-only for
  // session clients) and must always be scoped to the viewer's own collabs.
  let ownFilter: { column: 'brand_id' | 'creator_id'; id: string } | null =
    null;
  if (isBrand) {
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (brand) ownFilter = { column: 'brand_id', id: brand.id };
  } else {
    const { data: creator } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (creator) ownFilter = { column: 'creator_id', id: creator.id };
  }

  const { data: collabs } = ownFilter
    ? await createAdminClient()
        .from('collabs')
        .select(
          '*, campaigns(title), creator_profiles(id, user_id, users(display_name)), brand_profiles(company_name), stripe_payment_intent_id'
        )
        .eq(ownFilter.column, ownFilter.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Creators only see a collab once escrow is secured. Hidden from them: a
  // briefed/unfunded selection (their application still reads "Applied") and a
  // never-funded cancellation (an undone/expired selection they never knew
  // about). A genuinely-funded-then-cancelled collab still shows.
  const visibleCollabs = (collabs || []).filter((c) => {
    if (isBrand) return true;
    // Invite-accepted collabs are visible to the creator even before funding
    // (they explicitly accepted). Cold, unfunded brand selections stay hidden.
    if (c.status === 'briefed') return isPaymentSecured(c.payment_status) || c.from_invite;
    if (c.status === 'cancelled') return Boolean(c.funded_at);
    return true;
  });

  // Build display rows + filter bucket (Needs you / In progress / Completed /
  // Cancelled) server-side; the chip filtering happens client-side in
  // <CollabsList>. Same derivation as before — only the presentation fields
  // (statusKind/money/moneyKind, and a dedicated 'cancelled' bucket) are new.
  const rows: CollabRowData[] = visibleCollabs.map((c) => {
    const counterparty = isBrand
      ? (c.creator_profiles as any)?.users?.display_name || 'Creator'
      : (c.brand_profiles as any)?.company_name || 'Brand';
    const isBarter = (c.agreed_rate ?? 0) === 0;
    const view = deriveWorkflow({
      status: c.status,
      paymentStatus: c.payment_status,
      isBrand,
      counterpartName: counterparty,
      isBarter,
    });
    const turn = actorLabel(view, isBrand, counterparty);
    const cancelled = c.status === 'cancelled';
    const completed = c.status === 'completed';
    const secured = isPaymentSecured(c.payment_status);
    // Barter has no escrow — "Briefed/funded" reads as "Collaboration active".
    // A paid collab that's briefed but not yet funded reads "Awaiting funds"
    // rather than "Briefed", so the pending payment is obvious.
    const statusLabel =
      (isBarter && c.status === 'briefed')
        ? 'Collaboration active'
        : (c.status === 'briefed' && !secured)
          ? 'Awaiting funds'
          : COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label ||
            c.status;
    const statusKind = cancelled
      ? 'cancelled'
      : completed
        ? 'completed'
        : c.status === 'disputed'
          ? 'disputed'
          : turn.yourTurn
            ? 'needs'
            : 'progress';
    const [money, moneyKind]: [string, CollabRowData['moneyKind']] = cancelled
      ? [c.funded_at ? 'Refunded' : 'Not charged', 'void']
      : completed
        ? ['Released', 'released']
        : isBarter
          ? ['Barter', 'barter']
          : secured
            ? ['Protected', 'protected']
            : ['Awaiting payment', 'unfunded'];
    return {
      id: c.id,
      counterparty,
      initials: getInitials(counterparty),
      campaignTitle: c.campaigns?.title || 'Campaign',
      step: escrowStep(c.status, c.payment_status),
      statusLabel,
      statusKind,
      amount: isBarter ? 'Barter' : formatSGD(c.agreed_rate),
      money,
      moneyKind,
      bucket: cancelled
        ? 'cancelled'
        : completed
          ? 'completed'
          : turn.yourTurn
            ? 'needs'
            : 'progress',
      dimmed: completed || cancelled,
    };
  });

  // Stat-band aggregates — derived purely from the rows/collabs already loaded
  // above (no new queries, no logic change). Brand sees the deposit (agreed_rate)
  // it holds; creator sees the payout (creator_payout) coming to them.
  let fundsProtected = 0;
  let releasedTotal = 0;
  let activeProtectedCount = 0;
  let completedCount = 0;
  for (const c of visibleCollabs) {
    const active = !['completed', 'cancelled'].includes(c.status);
    if (isPaymentSecured(c.payment_status) && active) {
      fundsProtected += (isBrand ? c.agreed_rate : c.creator_payout) ?? 0;
      activeProtectedCount += 1;
    }
    if (c.status === 'completed') {
      releasedTotal += c.creator_payout ?? 0;
      completedCount += 1;
    }
  }
  const needsCount = rows.filter((r) => r.bucket === 'needs').length;
  const inProgressCount = rows.filter((r) => r.bucket === 'progress').length;
  const plural = (n: number) => (n === 1 ? '' : 's');

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 22 }}>
        <h1
          className="display-face"
          style={{ fontSize: 'clamp(24px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.03em' }}
        >
          Collaborations <InfoTip text={TERMS.collab} />
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 6 }}>
          {isBrand
            ? 'Review content, share feedback, and keep every collaboration on track.'
            : 'Manage drafts, approvals, and payments for every collaboration.'}
        </p>
      </div>

      {rows.length > 0 ? (
        <>
          {/* ── Stat band (responsive: 4 cards desktop · hero + 2 on mobile) ── */}
          <div className="cl-stats">
            {/* Funds protected — navy hero */}
            <div
              className="cl-stat-hero"
              style={{ background: 'var(--brand)', borderRadius: 14, padding: 18, color: '#fff', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>
                  {isBrand ? 'Funds protected' : 'Protected for you'}
                </span>
                <span className="cl-pulse" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--money)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={14} color="#fff" />
                </span>
              </div>
              <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
                {formatSGD(fundsProtected)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent-on-dark)', marginTop: 7 }}>
                {isBrand
                  ? `Held safely across ${activeProtectedCount} active collab${plural(activeProtectedCount)}`
                  : `Secured across ${activeProtectedCount} active collab${plural(activeProtectedCount)}`}
              </div>
            </div>

            <Stat
              label="Needs your action"
              value={String(needsCount)}
              sub={isBrand ? 'Review before the window closes' : 'Your move to keep things going'}
              subColor="var(--pending)"
              icon={<AlertCircle size={14} color="var(--pending)" />}
              iconBg="var(--pending-tint)"
            />
            <Stat
              label="In progress"
              value={String(inProgressCount)}
              sub="Live collaborations"
              icon={<Clock size={14} color="var(--brand)" />}
              iconBg="var(--brand-tint)"
            />
            <Stat
              className="cl-stat-released"
              label={isBrand ? 'Released to creators' : 'Earned'}
              value={formatSGD(releasedTotal)}
              sub={isBrand
                ? `Across ${completedCount} completed collab${plural(completedCount)}`
                : `Paid out across ${completedCount} collab${plural(completedCount)}`}
              icon={<CheckCircle2 size={14} color="var(--money)" />}
              iconBg="var(--money-tint)"
            />
          </div>

          <CollabsList rows={rows} />
          <div
            style={{
              marginTop: 18,
              padding: '22px 24px',
              background: 'linear-gradient(135deg, var(--accent-tint-2), var(--accent-tint))',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                {isBrand
                  ? 'Want more creators on board?'
                  : 'Ready for your next collab?'}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '3px 0 0' }}>
                {isBrand
                  ? 'Post another campaign and the right creators will come to you.'
                  : 'Fresh campaigns drop daily, find one that fits you.'}
              </p>
            </div>
            <Link
              href={isBrand ? '/post-job' : '/jobs'}
              className="btn-primary"
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              {isBrand ? (
                <>
                  <Megaphone size={15} /> Post a campaign
                </>
              ) : (
                <>
                  <Compass size={15} /> Discover campaigns
                </>
              )}
            </Link>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Briefcase}
          title={
            isBrand
              ? 'Your first collab starts here'
              : 'Your first collab is close'
          }
          body={isBrand
            ? 'Your collaborations will appear here once you accept a creator.'
            : 'Your collaborations will appear here once a brand accepts your application.'}
          actionHref={isBrand ? '/campaigns' : '/jobs'}
          actionLabel={isBrand ? 'Go to campaigns' : 'Discover campaigns'}
        />
      )}
    </div>
  );
}
