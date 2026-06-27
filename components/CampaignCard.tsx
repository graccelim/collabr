import Link from 'next/link';
import { ChevronRight, ArrowRight, Lock } from 'lucide-react';
import { formatSGD, getInitials } from '@/lib/utils';

export interface CampaignRow {
  id: string;
  title: string;
  status: string;
  comp_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  creators_needed: number;
  deadline: string | null;
  applicants: number;
  confirmed: number;
  awaiting: number;
  available: number;
  inEscrow: number;
  applicantNames: string[];
}

function fmtDeadline(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}
function budgetLabel(c: CampaignRow): string {
  if (c.budget_min) return `${formatSGD(c.budget_min)}${c.budget_max ? ` to ${formatSGD(c.budget_max)}` : ''}`;
  return c.comp_type === 'barter' ? 'Barter' : '—';
}
function StatusPill({ status }: { status: string }) {
  const c = status === 'active'
    ? { bg: 'var(--money-tint)', fg: 'var(--money-deep)', dot: 'var(--money)' }
    : status === 'draft'
      ? { bg: 'var(--surface-2)', fg: 'var(--ink-faint-solid)', dot: '#B7BCC6' }
      : { bg: 'var(--brand-tint)', fg: 'var(--brand)', dot: 'var(--brand)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.bg, border: `1px solid ${c.fg}22`, color: c.fg, fontSize: 11.5, fontWeight: 500, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />{status}
    </span>
  );
}
function Avatars({ names }: { names: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {names.slice(0, 3).map((n, i) => (
        <span key={`${n}-${i}`} style={{ width: 28, height: 28, borderRadius: 999, marginLeft: i ? -9 : 0, background: 'var(--brand-tint)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10.5, boxShadow: '0 0 0 2px var(--surface)' }}>{getInitials(n)}</span>
      ))}
    </div>
  );
}
function pct(confirmed: number, needed: number) { return needed ? Math.round((confirmed / needed) * 100) : 0; }

/** Desktop: full-width rich card with a 5-column stat grid + applicant footer. */
export function CampaignDesktopCard({ c }: { c: CampaignRow }) {
  const isBarter = c.comp_type === 'barter';
  const stats: { k: string; v: string; mono?: boolean; money?: boolean }[] = [
    { k: 'Applicants', v: String(c.applicants) },
    { k: 'Spots filled', v: `${c.confirmed}/${c.creators_needed}` },
    { k: 'Budget', v: budgetLabel(c), mono: true },
    { k: 'Due', v: fmtDeadline(c.deadline), mono: true },
    isBarter ? { k: 'Available', v: String(c.available) } : { k: 'Protected', v: formatSGD(c.inEscrow), mono: true, money: c.inEscrow > 0 },
  ];
  return (
    <Link href={`/campaigns/${c.id}`} className="cl-trow card" style={{ display: 'block', padding: 20, textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{c.title}</span>
          <StatusPill status={c.status} />
        </div>
        <ChevronRight size={18} style={{ color: '#B7BCC6', flexShrink: 0 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 14 }}>
        {stats.map((s) => (
          <div key={s.k}>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>{s.k}</div>
            {s.k === 'Spots filled' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>{s.v}</span>
                <span style={{ flex: 1, maxWidth: 54, height: 5, borderRadius: 999, background: 'rgba(14,16,22,.1)', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${pct(c.confirmed, c.creators_needed)}%`, background: 'var(--money)', borderRadius: 999 }} />
                </span>
              </div>
            ) : s.k === 'Applicants' ? (
              <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>{s.v}</span>
            ) : (
              <div className={s.mono ? 'mono-num' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 600, color: s.money ? 'var(--money-deep)' : 'var(--ink)' }}>
                {s.k === 'Protected' && s.money && <Lock size={13} style={{ color: 'var(--money)' }} />}{s.v}
              </div>
            )}
          </div>
        ))}
      </div>
      {(c.status === 'active' && c.applicants > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <Avatars names={c.applicantNames} />
            <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{c.applicants} creator{c.applicants > 1 ? 's' : ''} applied</span>
          </div>
          <span className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>Review applicants <ArrowRight size={15} /></span>
        </div>
      )}
    </Link>
  );
}

/** Mobile: compact card — 3-stat row + budget/protected box + footer. */
export function CampaignMobileCard({ c }: { c: CampaignRow }) {
  const money = c.comp_type !== 'barter';
  return (
    <Link href={`/campaigns/${c.id}`} className="cl-mcard card" style={{ display: 'block', padding: 15, textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
          <StatusPill status={c.status} />
        </div>
        <ChevronRight size={16} style={{ color: '#B7BCC6', flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 8.5, marginBottom: 4 }}>Applicants</div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.applicants}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 8.5, marginBottom: 4 }}>Spots filled</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.confirmed}/{c.creators_needed}</span>
            <span style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(14,16,22,.1)', position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', inset: 0, width: `${pct(c.confirmed, c.creators_needed)}%`, background: 'var(--money)', borderRadius: 999 }} />
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 8.5, marginBottom: 4 }}>Due</div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDeadline(c.deadline)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: money && c.inEscrow > 0 ? 'var(--money-tint)' : 'var(--surface-2)', border: `1px solid ${money && c.inEscrow > 0 ? 'var(--money)22' : 'var(--line)'}`, borderRadius: 10, padding: '10px 12px', marginBottom: 13 }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 8.5, marginBottom: 2 }}>Budget</div>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{budgetLabel(c)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="eyebrow" style={{ fontSize: 8.5, marginBottom: 2 }}>{money ? 'Protected' : 'Available'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', fontSize: 13, fontWeight: 600, color: money && c.inEscrow > 0 ? 'var(--money-deep)' : 'var(--ink)' }}>
            {money && c.inEscrow > 0 && <Lock size={12} style={{ color: 'var(--money)' }} />}{money ? formatSGD(c.inEscrow) : String(c.available)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatars names={c.applicantNames} />
          <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>{c.applicants} applied</span>
        </div>
        <span className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Review <ArrowRight size={13} /></span>
      </div>
    </Link>
  );
}
