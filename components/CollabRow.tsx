import Link from 'next/link';
import { ChevronRight, Lock, Check, ArrowRight } from 'lucide-react';

export interface CollabRowData {
  id: string;
  counterparty: string;
  initials: string;
  campaignTitle: string;
  step: number;
  statusLabel: string;
  statusKind: 'needs' | 'progress' | 'completed' | 'cancelled' | 'disputed';
  amount: string;
  money: string;
  moneyKind: 'protected' | 'released' | 'void' | 'barter' | 'unfunded';
  bucket: 'needs' | 'progress' | 'completed' | 'cancelled';
  dimmed: boolean;
  // filter/sort data
  amountCents: number;
  createdAt: number;
  needsAction: boolean;
}

const PILL: Record<CollabRowData['statusKind'], { bg: string; fg: string; dot: string }> = {
  needs: { bg: 'var(--pending-tint)', fg: 'var(--pending)', dot: 'var(--pending)' },
  progress: { bg: 'var(--brand-tint)', fg: 'var(--brand)', dot: 'var(--brand)' },
  completed: { bg: 'var(--money-tint)', fg: 'var(--money-deep)', dot: 'var(--money)' },
  cancelled: { bg: 'var(--surface-2)', fg: 'var(--ink-faint-solid)', dot: '#B7BCC6' },
  disputed: { bg: 'var(--danger-tint)', fg: 'var(--danger)', dot: 'var(--danger)' },
};

function Pill({ kind, label }: { kind: CollabRowData['statusKind']; label: string }) {
  const c = PILL[kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: c.bg, border: `1px solid ${c.fg}22`, color: c.fg, fontSize: 12, fontWeight: 500, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function Steps({ step, fluid = false }: { step: number; fluid?: boolean }) {
  return (
    <span style={{ display: 'flex', gap: fluid ? 4 : 3, alignItems: 'center', flex: fluid ? 1 : undefined }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: fluid ? undefined : 13, flex: fluid ? 1 : undefined, height: 5, borderRadius: 999, background: i <= step ? 'var(--money)' : 'rgba(14,16,22,.1)' }} />
      ))}
    </span>
  );
}

function Money({ kind, label }: { kind: CollabRowData['moneyKind']; label: string }) {
  const fg = kind === 'void' || kind === 'unfunded' ? 'var(--ink-faint-solid)' : kind === 'barter' ? 'var(--ink-soft)' : 'var(--money-deep)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: fg }}>
      {kind === 'protected' && <Lock size={11} style={{ color: 'var(--money)' }} />}
      {kind === 'released' && <Check size={11} strokeWidth={2.6} style={{ color: 'var(--money)' }} />}
      {label}
    </span>
  );
}

const AV = (r: CollabRowData, size: number) => (
  <span style={{ width: size, height: size, flex: 'none', borderRadius: 11, background: r.bucket === 'cancelled' ? 'var(--surface-2)' : 'var(--brand-tint)', color: r.bucket === 'cancelled' ? '#B7BCC6' : 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{r.initials}</span>
);

export const COLLAB_GRID = 'minmax(0,1fr) 168px 168px 132px 22px';

export function CollabDesktopRow({ r }: { r: CollabRowData }) {
  return (
    <Link href={`/collabs/${r.id}`} className="cl-trow" style={{ display: 'grid', gridTemplateColumns: COLLAB_GRID, gap: 20, alignItems: 'center', padding: '15px 22px', borderBottom: '1px solid var(--line)', textDecoration: 'none', opacity: r.dimmed ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
        {AV(r, 40)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: r.dimmed ? 'var(--ink-faint-solid)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.counterparty}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaignTitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Steps step={r.step} />
        <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>{r.bucket === 'cancelled' ? '—' : `${r.step}/5`}</span>
      </div>
      <div><Pill kind={r.statusKind} label={r.statusLabel} /></div>
      <div style={{ textAlign: 'right' }}>
        <div className="mono-num" style={{ fontWeight: 600, fontSize: 15, color: r.dimmed ? 'var(--ink-faint-solid)' : 'var(--ink)', textDecoration: r.moneyKind === 'void' ? 'line-through' : 'none' }}>{r.amount}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}><Money kind={r.moneyKind} label={r.money} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><ChevronRight size={16} style={{ color: '#B7BCC6' }} /></div>
    </Link>
  );
}

export function CollabMobileCard({ r }: { r: CollabRowData }) {
  const action = r.bucket === 'cancelled' ? 'closed' : r.bucket === 'needs' ? 'review' : 'view';
  return (
    <Link href={`/collabs/${r.id}`} className="cl-mcard card" style={{ padding: 15, textDecoration: 'none', opacity: r.dimmed ? 0.7 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
        {AV(r, 38)}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: r.dimmed ? 'var(--ink-faint-solid)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.counterparty}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaignTitle}</div>
        </div>
        <Pill kind={r.statusKind} label={r.statusLabel} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <Steps step={r.step} fluid />
        <span className="mono-num" style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', flex: 'none' }}>{r.bucket === 'cancelled' ? '—' : `${r.step}/5`}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <div>
          <div className="mono-num" style={{ fontWeight: 600, fontSize: 15, color: r.dimmed ? 'var(--ink-faint-solid)' : 'var(--ink)', textDecoration: r.moneyKind === 'void' ? 'line-through' : 'none' }}>{r.amount}</div>
          <div style={{ marginTop: 2 }}><Money kind={r.moneyKind} label={r.money} /></div>
        </div>
        {action === 'review' && <span className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Review <ArrowRight size={13} /></span>}
        {action === 'view' && <span className="btn btn-secondary btn-sm">View</span>}
        {action === 'closed' && <span style={{ fontSize: 12, color: '#B7BCC6' }}>Closed</span>}
      </div>
    </Link>
  );
}
