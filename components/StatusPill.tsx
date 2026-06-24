// Plain (non-client) status pill shared by the Applications + Invites screens.
// Matches the design: a soft tinted pill with a leading dot. Kept server-safe so
// server components can render it directly.
type Kind = 'applied' | 'review' | 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

const MAP: Record<Kind, { bg: string; fg: string; dot: string }> = {
  applied: { bg: 'var(--brand-tint)', fg: 'var(--brand)', dot: 'var(--brand)' },
  review: { bg: 'var(--pending-tint)', fg: 'var(--pending)', dot: 'var(--pending)' },
  pending: { bg: 'var(--pending-tint)', fg: 'var(--pending)', dot: 'var(--pending)' },
  accepted: { bg: 'var(--money-tint)', fg: 'var(--money-deep)', dot: 'var(--money)' },
  declined: { bg: 'var(--surface-2)', fg: 'var(--ink-faint-solid)', dot: '#B7BCC6' },
  withdrawn: { bg: 'var(--surface-2)', fg: 'var(--ink-faint-solid)', dot: '#B7BCC6' },
  expired: { bg: 'var(--surface-2)', fg: 'var(--ink-faint-solid)', dot: '#B7BCC6' },
};

export default function StatusPill({ kind, label }: { kind: Kind; label: string }) {
  const c = MAP[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
      background: c.bg, border: `1px solid ${c.fg}22`, color: c.fg,
      fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export type StatusPillKind = Kind;
