import { createClient } from '@/lib/supabase/server';
import { requireCreator } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD, relativeTime, getInitials } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { Send } from 'lucide-react';
import { creatorApplicationState, CREATOR_APP_LABEL } from '@/lib/collab-status';
import WithdrawApplicationButton from '@/components/WithdrawApplicationButton';
import StatusPill, { type StatusPillKind } from '@/components/StatusPill';

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

function DesktopRow({ r, last }: { r: AppRowData; last: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 160px 130px 110px', gap: 18,
      alignItems: 'center', padding: '15px 18px', borderBottom: last ? 'none' : '1px solid var(--line)',
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

function Section({ title, count, rows, muted = false }: { title: string; count: number; rows: AppRowData[]; muted?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 600, fontSize: 15, color: muted ? 'var(--ink-soft)' : 'var(--ink)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 999 }}>{count}</span>
      </div>
      <div className="cl-desktop card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((r, i) => <DesktopRow key={r.id} r={r} last={i === rows.length - 1} />)}
      </div>
      <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => <MobileCard key={r.id} r={r} />)}
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
    if (rejected) { pillKind = 'declined'; pillLabel = 'Not selected'; }
    else if (withdrawnStatus) { pillKind = 'withdrawn'; pillLabel = 'Withdrawn'; }
    else if (inviteAccepted) { pillKind = 'accepted'; pillLabel = 'Invite accepted'; }
    else if (confirmed) { pillKind = 'accepted'; pillLabel = collab?.agreed_rate === 0 ? 'Confirmed' : (CREATOR_APP_LABEL.confirmed || 'Confirmed'); }
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
    };
  };

  const activeRows = activeApps.map(toRow);
  const pastRows = pastApps.map(toRow);

  // Stat-band aggregates (derived from the rows already built — no new queries).
  const acceptedCount = activeRows.filter((r) => r.pillKind === 'accepted').length;
  const awaitingCount = activeRows.length - acceptedCount;
  let potential = 0;
  for (const app of activeApps) {
    const c = app.campaigns;
    potential += (c?.budget_max ?? c?.budget_min ?? app.proposed_rate ?? 0) || 0;
  }

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
        <>
          {/* ── Stat band ── */}
          <div className="cl-stats cl-desktop" style={{ display: 'grid' }}>
            <StatTile label="Active applications" value={String(activeApps.length)} />
            <StatTile label="Awaiting response" value={String(awaitingCount)} valueColor="var(--pending)" />
            <StatTile label="Accepted" value={String(acceptedCount)} valueColor="var(--money-deep)" />
            <div style={{ background: 'var(--brand)', borderRadius: 14, padding: 18, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>Potential value</span>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--money)' }} />
              </div>
              <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{potential > 0 ? `up to ${formatSGD(potential)}` : '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--accent-on-dark)', marginTop: 7 }}>across active applications</div>
            </div>
          </div>

          {/* mobile stat band — value hero + 3 chips */}
          <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
            <div className="card" style={{ padding: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Potential value</div>
                <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em', lineHeight: 1 }}>{potential > 0 ? `up to ${formatSGD(potential)}` : '—'}</div>
              </div>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--money-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--money)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16M6 8h9a3 3 0 010 6H8" /></svg>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <MobileChip value={String(activeApps.length)} label="active" />
              <MobileChip value={String(awaitingCount)} label="awaiting" valueColor="var(--pending)" />
              <MobileChip value={String(acceptedCount)} label="accepted" valueColor="var(--money-deep)" />
            </div>
          </div>

          <Section title="Active" count={activeRows.length} rows={activeRows} />
          <Section title="Past" count={pastRows.length} rows={pastRows} muted />
        </>
      )}
    </div>
  );
}

/** Desktop white stat tile. */
function StatTile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 9 }}>{label}</div>
      <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: valueColor || 'var(--ink)' }}>{value}</div>
    </div>
  );
}

/** Mobile compact stat chip. */
function MobileChip({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <div className="card" style={{ flex: 1, padding: 11 }}>
      <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 19, lineHeight: 1, color: valueColor || 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-faint-solid)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
