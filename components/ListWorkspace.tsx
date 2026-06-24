'use client';
import { useMemo, useState, type ReactNode } from 'react';

/* One row in the list. The page renders `desktop`/`mobile` (preserving all of
   its own logic + action components); this component only filters, sorts and
   shows them — it never changes behaviour. */
export interface LWItem {
  id: string;
  status: string; // maps to a LWStatus.key
  amountCents: number | null; // for amount sort (null sorts last)
  createdAt: number; // ms epoch, for recent sort
  needsAction: boolean; // for "needs action first" sort
  campaign?: string; // for the per-campaign filter
  desktop: ReactNode;
  mobile: ReactNode;
}

export interface LWTile {
  label: string;
  value: string;
  valueColor?: string;
  /** Navy hero tile (the $ one). */
  hero?: boolean;
  heroIcon?: 'shield' | 'dollar' | 'dot';
  heroSub?: string;
  /** Clicking the tile selects exactly these statuses (toggles off if already set). */
  filter?: string[];
  /** Hidden from the mobile chip row (desktop-only tile). */
  mobileHidden?: boolean;
}

export interface LWStatus { key: string; label: string; dot?: string }
export type LWSort = 'needs' | 'recent' | 'amount';

const SORT_LABEL: Record<LWSort, string> = {
  needs: 'Needs action first',
  recent: 'Most recent',
  amount: 'Amount: high to low',
};

function HeroIcon({ kind }: { kind?: LWTile['heroIcon'] }) {
  if (kind === 'dot') return <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--money)' }} />;
  const chip = (child: ReactNode) => (
    <span className="cl-pulse" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--money)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{child}</span>
  );
  if (kind === 'dollar') return chip(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>);
  return chip(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>);
}

export default function ListWorkspace({
  tiles,
  statuses,
  sorts,
  campaigns,
  items,
  desktopHeader,
  emptyLabel = 'Nothing matches these filters.',
  variant = 'table',
}: {
  tiles: LWTile[];
  statuses: LWStatus[];
  sorts: LWSort[];
  campaigns?: string[];
  items: LWItem[];
  desktopHeader?: ReactNode;
  emptyLabel?: string;
  /** 'table' = desktop rows in one card; 'cards' = a column of cards (rich rows). */
  variant?: 'table' | 'cards';
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [campaign, setCampaign] = useState<string>('all');
  const [sort, setSort] = useState<LWSort>(sorts[0]);

  const dirty = selected.length > 0 || campaign !== 'all' || sort !== sorts[0];

  const toggleStatus = (key: string) =>
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  // A stat tile sets the status filter to exactly its keys (toggles off if same).
  const tileClick = (keys: string[]) =>
    setSelected((cur) => (cur.length === keys.length && keys.every((k) => cur.includes(k)) ? [] : keys));

  const clear = () => { setSelected([]); setCampaign('all'); setSort(sorts[0]); };

  const shown = useMemo(() => {
    let out = items.filter((it) =>
      (selected.length === 0 || selected.includes(it.status)) &&
      (campaign === 'all' || it.campaign === campaign)
    );
    out = [...out].sort((a, b) => {
      if (sort === 'amount') return (b.amountCents ?? -1) - (a.amountCents ?? -1);
      if (sort === 'needs' && a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
    return out;
  }, [items, selected, campaign, sort]);

  const tileActive = (keys?: string[]) =>
    !!keys && keys.length === selected.length && keys.every((k) => selected.includes(k));

  const chipTiles = tiles.filter((t) => !t.hero && !t.mobileHidden);
  const heroTile = tiles.find((t) => t.hero);

  const HeroCard = ({ t, mobile }: { t: LWTile; mobile?: boolean }) => (
    <div style={{ background: 'var(--brand)', borderRadius: 14, padding: mobile ? 15 : 18, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>{t.label}</span>
        <HeroIcon kind={t.heroIcon} />
      </div>
      <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', fontSize: mobile ? 28 : undefined }}>{t.value}</div>
      {t.heroSub && <div style={{ fontSize: mobile ? 12 : 11.5, color: 'var(--accent-on-dark)', marginTop: 7 }}>{t.heroSub}</div>}
    </div>
  );

  const CountTile = ({ t }: { t: LWTile }) => {
    const active = tileActive(t.filter);
    return (
      <button
        type="button"
        onClick={() => t.filter && tileClick(t.filter)}
        className="card"
        style={{
          padding: 16, textAlign: 'left', cursor: t.filter ? 'pointer' : 'default',
          border: active ? '1px solid var(--brand)' : undefined,
          boxShadow: active ? '0 0 0 1px var(--brand) inset' : undefined,
          transition: 'box-shadow .12s ease, border-color .12s ease',
        }}
      >
        <div className="eyebrow" style={{ fontSize: 10, marginBottom: 9 }}>{t.label}</div>
        <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: t.valueColor || 'var(--ink)' }}>{t.value}</div>
      </button>
    );
  };

  return (
    <>
      {/* ── Stat band ── */}
      <div className="cl-stats cl-desktop" style={{ display: 'grid' }}>
        {tiles.map((t, i) => t.hero ? <HeroCard key={i} t={t} /> : <CountTile key={i} t={t} />)}
      </div>
      <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
        {heroTile && <HeroCard t={heroTile} mobile />}
        {chipTiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {chipTiles.map((t, i) => {
              const active = tileActive(t.filter);
              return (
                <button key={i} type="button" onClick={() => t.filter && tileClick(t.filter)} className="card"
                  style={{ flex: 1, padding: 11, textAlign: 'left', cursor: t.filter ? 'pointer' : 'default', boxShadow: active ? '0 0 0 1px var(--brand) inset' : undefined }}>
                  <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 19, lineHeight: 1, color: t.valueColor || 'var(--ink)' }}>{t.value}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint-solid)', marginTop: 4 }}>{t.label}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cl-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <button type="button" onClick={() => setSelected([])}
            style={chipStyle(selected.length === 0)}>All <span style={{ color: selected.length === 0 ? 'rgba(255,255,255,.6)' : 'var(--ink-faint-solid)' }}>{items.length}</span></button>
          {statuses.map((s) => {
            const on = selected.includes(s.key);
            const n = items.filter((it) => it.status === s.key).length;
            return (
              <button key={s.key} type="button" onClick={() => toggleStatus(s.key)} style={chipStyle(on)}>
                {s.dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, flexShrink: 0 }} />}
                {s.label} <span style={{ color: on ? 'rgba(255,255,255,.6)' : 'var(--ink-faint-solid)' }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {campaigns && campaigns.length > 1 && (
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} style={selectStyle}>
              <option value="all">All campaigns</option>
              {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value as LWSort)} style={selectStyle}>
            {sorts.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
          </select>
          {dirty && (
            <button type="button" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Clear</button>
          )}
        </div>
      </div>

      {/* ── Desktop ── */}
      {variant === 'table' ? (
        <div className="cl-desktop card" style={{ padding: 0, overflow: 'hidden' }}>
          {desktopHeader}
          {shown.map((it) => <div key={it.id}>{it.desktop}</div>)}
          {shown.length === 0 && <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>{emptyLabel}</div>}
        </div>
      ) : (
        <div className="cl-desktop">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {shown.map((it) => <div key={it.id}>{it.desktop}</div>)}
            {shown.length === 0 && <div className="card" style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>{emptyLabel}</div>}
          </div>
        </div>
      )}

      {/* ── Mobile cards ── */}
      <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 11 }}>
        {shown.map((it) => <div key={it.id}>{it.mobile}</div>)}
        {shown.length === 0 && <div className="card" style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint-solid)' }}>{emptyLabel}</div>}
      </div>
    </>
  );
}

function chipStyle(on: boolean): React.CSSProperties {
  return {
    flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
    height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
    fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
    background: on ? 'var(--brand)' : 'var(--surface)',
    color: on ? '#fff' : 'var(--ink)',
    border: `1px solid ${on ? 'transparent' : 'var(--line-strong)'}`,
    transition: 'all .14s ease',
  };
}

const selectStyle: React.CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 9, cursor: 'pointer',
  fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ink)',
  background: 'var(--surface)', border: '1px solid var(--line-strong)',
};
