import { createClient } from '@/lib/supabase/server';
import { requireCreator } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD, relativeTime, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { Send } from 'lucide-react';
import { creatorApplicationState, CREATOR_APP_LABEL } from '@/lib/collab-status';
import WithdrawApplicationButton from '@/components/WithdrawApplicationButton';
import StatusPill, { type StatusPillKind } from '@/components/StatusPill';
import ListWorkspace, { type LWItem, type LWTile, type LWStatus } from '@/components/ListWorkspace';

type AppRowData = {
  id: string;
  campaignTitle: string;
  brandName: string;
  initials: string;
  meta: string;
  budget: string;
  pillKind: StatusPillKind;
  pillLabel: string;
  href: string;
  protectedNote: boolean;
  muted: boolean;
  /** Set when the row links to a live collab ("View collab"). */
  viewLabel: string | null;
  /** Set when the open application can still be withdrawn. */
  withdrawId: string | null;
  /** Rejected/withdrawn → a quiet "Closed" marker. */
  closed: boolean;
  /** filter/sort data */
  filterStatus: 'applied' | 'accepted' | 'past';
  amountCents: number;
  createdAt: number;
};

const PROTECTED_TAG = (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--money-deep)' }}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--money)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
    Protected on start
  </span>
);

function Avatar({ initials, muted }: { initials: string; muted: boolean }) {
  return (
    <span style={{
      width: 38, height: 38, flex: 'none', borderRadius: 11,
      background: muted ? 'var(--surface-2)' : 'var(--brand-tint)',
      color: muted ? '#B7BCC6' : 'var(--brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
    }}>{initials}</span>
  );
}

function ActionEl({ r }: { r: AppRowData }) {
  if (r.viewLabel) return <Link href={r.href} className="btn btn-secondary btn-sm">{r.viewLabel}</Link>;
  if (r.withdrawId) return <WithdrawApplicationButton applicationId={r.withdrawId} />;
  if (r.closed) return <span style={{ fontSize: 12, color: '#B7BCC6' }}>Closed</span>;
  return null;
}

function DesktopRow({ r }: { r: AppRowData }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 132px 118px', gap: 16,
      alignItems: 'center', padding: '15px 18px', borderBottom: '1px solid var(--line)',
    }}>
      <Link href={r.href} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none' }}>
        <Avatar initials={r.initials} muted={r.muted} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaignTitle}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: 'var(--ink-soft)' }}>{r.brandName}</span> · {r.meta}</div>
        </div>
      </Link>
      <div>
        <div className="mono-num" style={{ fontSize: 13.5, fontWeight: 500, color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{r.budget}</div>
        {r.protectedNote && <div style={{ marginTop: 4 }}>{PROTECTED_TAG}</div>}
      </div>
      <div><StatusPill kind={r.pillKind} label={r.pillLabel} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionEl r={r} /></div>
    </div>
  );
}

function MobileCard({ r }: { r: AppRowData }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <Link href={r.href} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12, textDecoration: 'none' }}>
        <Avatar initials={r.initials} muted={r.muted} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaignTitle}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: 'var(--ink-soft)' }}>{r.brandName}</span> · {r.meta}</div>
        </div>
        <StatusPill kind={r.pillKind} label={r.pillLabel} />
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 11, borderTop: '1px solid var(--line)' }}>
        <div>
          <div className="mono-num" style={{ fontSize: 14, fontWeight: 600, color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{r.budget}</div>
          {r.protectedNote && <div style={{ marginTop: 3 }}>{PROTECTED_TAG}</div>}
        </div>
        <ActionEl r={r} />
      </div>
    </div>
  );
}

export default async function ApplicationsPage() {
  const user = await requireCreator();
  const supabase = createClient();

  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const { data: applications } = await supabase
    .from('applications')
    .select(
      '*, campaigns(id, title, comp_type, budget_min, budget_max, brand_profiles(company_name))'
    )
    .eq('creator_id', creator!.id)
    .order('created_at', { ascending: false });

  // For selected applications, load the collab WITH its payment_status — a
  // selected-but-unfunded collab is never surfaced to the creator (their app
  // still reads "Applied"); only a funded one becomes "Confirmed".
  const selectedAppIds = (applications || [])
    .filter((a) => a.status === 'selected')
    .map((a) => a.id);

  const collabByApp: Record<string, { id: string; payment_status: string; status: string; agreed_rate: number; from_invite: boolean }> = {};
  if (selectedAppIds.length > 0) {
    const { data: collabs } = await supabase
      .from('collabs')
      .select('id, application_id, payment_status, status, agreed_rate, from_invite')
      .in('application_id', selectedAppIds);
    collabs?.forEach((c) => {
      if (c.application_id && c.status !== 'cancelled') collabByApp[c.application_id] = { id: c.id, payment_status: c.payment_status, status: c.status, agreed_rate: c.agreed_rate, from_invite: !!c.from_invite };
    });
  }

  const activeApps = (applications || []).filter((a) => !['rejected', 'withdrawn'].includes(a.status));
  const pastApps = (applications || []).filter((a) => a.status === 'rejected');

  // Build a presentation row from each application — preserves the exact
  // state/href/withdraw logic of the original, just shaped for the new layout.
  const toRow = (app: any): AppRowData => {
    const campaign = app.campaigns;
    const brandName = campaign?.brand_profiles?.company_name || 'Brand';
    const collab = collabByApp[app.id];
    const state = creatorApplicationState(app.status, collab);
    const confirmed = state === 'confirmed';
    const inviteAccepted = !!collab?.from_invite && !confirmed;
    const showsCollab = (confirmed || inviteAccepted) && !!collab;
    const rejected = app.status === 'rejected';
    const withdrawnStatus = app.status === 'withdrawn';
    const budget = (campaign?.budget_min || campaign?.budget_max)
      ? `${campaign.budget_min ? formatSGD(campaign.budget_min) : '—'}${campaign.budget_max ? ` – ${formatSGD(campaign.budget_max)}` : ''}`
      : (app.proposed_rate ? formatSGD(app.proposed_rate) : '—');
    let pillKind: StatusPillKind = 'applied';
    let pillLabel = CREATOR_APP_LABEL[state] || 'Applied';
    // Keep pill labels short — the "Protected on start" tag under the amount
    // already conveys the secured payment, and long labels overflow the column.
    if (rejected) { pillKind = 'declined'; pillLabel = 'Not selected'; }
    else if (withdrawnStatus) { pillKind = 'withdrawn'; pillLabel = 'Withdrawn'; }
    else if (inviteAccepted) { pillKind = 'accepted'; pillLabel = 'Accepted'; }
    else if (confirmed) { pillKind = 'accepted'; pillLabel = 'Confirmed'; }
    return {
      id: app.id,
      campaignTitle: campaign?.title || 'Campaign',
      brandName,
      initials: getInitials(brandName),
      meta: relativeTime(app.created_at),
      budget,
      pillKind,
      pillLabel,
      href: showsCollab && collab ? `/collabs/${collab.id}` : `/jobs/${campaign?.id}`,
      protectedNote: showsCollab && (collab?.agreed_rate ?? 0) > 0,
      muted: rejected || withdrawnStatus,
      viewLabel: showsCollab ? 'View collab' : null,
      withdrawId: !showsCollab && !collab && !rejected && !withdrawnStatus ? app.id : null,
      closed: rejected || withdrawnStatus,
      filterStatus: (rejected || withdrawnStatus) ? 'past' : pillKind === 'accepted' ? 'accepted' : 'applied',
      amountCents: (campaign?.budget_max ?? campaign?.budget_min ?? app.proposed_rate ?? 0) || 0,
      createdAt: app.created_at ? new Date(app.created_at).getTime() : 0,
    };
  };

  // One combined list (active first, then past) — the filter bar/sort replaces
  // the old fixed sections.
  const allRows = [...activeApps.map(toRow), ...pastApps.map(toRow)];

  // Stat-band aggregates (derived from the rows already built — no new queries).
  const activeRows = allRows.filter((r) => r.filterStatus !== 'past');
  const acceptedCount = activeRows.filter((r) => r.filterStatus === 'accepted').length;
  const awaitingCount = activeRows.length - acceptedCount;
  let potential = 0;
  for (const app of activeApps) {
    const c = app.campaigns;
    potential += (c?.budget_max ?? c?.budget_min ?? app.proposed_rate ?? 0) || 0;
  }

  const items: LWItem[] = allRows.map((r) => ({
    id: r.id,
    status: r.filterStatus,
    amountCents: r.amountCents,
    createdAt: r.createdAt,
    needsAction: false,
    campaign: r.campaignTitle,
    desktop: <DesktopRow r={r} />,
    mobile: <MobileCard r={r} />,
  }));
  const tiles: LWTile[] = [
    { label: 'Active applications', value: String(activeRows.length), filter: ['applied', 'accepted'] },
    { label: 'Awaiting response', value: String(awaitingCount), valueColor: 'var(--pending)', filter: ['applied'] },
    { label: 'Accepted', value: String(acceptedCount), valueColor: 'var(--money-deep)', filter: ['accepted'] },
    { label: 'Potential value', value: potential > 0 ? `up to ${formatSGD(potential)}` : '—', hero: true, heroIcon: 'dollar', heroSub: 'across active applications' },
  ];
  const statuses: LWStatus[] = [
    { key: 'applied', label: 'Applied', dot: 'var(--brand)' },
    { key: 'accepted', label: 'Accepted', dot: 'var(--money)' },
    { key: 'past', label: 'Past', dot: '#B7BCC6' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Outbound</div>
        <h1 className="display-face" style={{ fontSize: 'clamp(23px,3vw,28px)', fontWeight: 700, letterSpacing: '-0.03em' }}>My applications</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 6, fontSize: 14.5 }}>
          Keep track of every opportunity you&apos;ve applied to and its current status.
        </p>
      </div>

      {(!applications || applications.length === 0) ? (
        <EmptyState
          icon={Send}
          title="Your pitches show up here"
          body="You haven't applied to any campaigns yet. Browse open campaigns and apply to ones that fit you."
          actionHref="/jobs"
          actionLabel="Browse campaigns"
        />
      ) : (
        <ListWorkspace
          tiles={tiles}
          statuses={statuses}
          sorts={['recent', 'amount']}
          items={items}
          emptyLabel="No applications match these filters."
        />
      )}
    </div>
  );
}
