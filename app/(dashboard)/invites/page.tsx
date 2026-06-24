import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAuth, getUserRow } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD, relativeTime } from '@/lib/utils';
import Avatar from '@/components/Avatar';
import InviteActions from '@/components/InviteActions';
import MarkInvitesSeen from '@/components/MarkInvitesSeen';
import EmptyState from '@/components/EmptyState';
import BoostHint from '@/components/BoostHint';
import StatusPill, { type StatusPillKind } from '@/components/StatusPill';
import { boostUiEnabled, boostPreview } from '@/lib/stripe';
import { Send, Mail, Zap, Shield } from 'lucide-react';

// Maps an invite status to the shared pill kind.
const PILL_KIND: Record<string, StatusPillKind> = {
  pending: 'pending',
  accepted: 'accepted',
  declined: 'declined',
  expired: 'expired',
};
const PILL_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

/* Section header (title + count chip), shared. */
function SectionHead({ title, count, tone }: { title: string; count: number; tone?: 'pending' | 'muted' }) {
  const countStyle = tone === 'pending'
    ? { color: 'var(--pending)', background: 'var(--pending-tint)' }
    : { color: 'var(--ink-faint-solid)', background: 'var(--surface-2)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 600, fontSize: 15, color: tone === 'muted' ? 'var(--ink-soft)' : 'var(--ink)' }}>{title}</span>
      <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 999, ...countStyle }}>{count}</span>
    </div>
  );
}

/* Desktop white stat tile. */
function StatTile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 9 }}>{label}</div>
      <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: valueColor || 'var(--ink)' }}>{value}</div>
    </div>
  );
}
function MobileChip({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <div className="card" style={{ flex: 1, padding: 11 }}>
      <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 19, lineHeight: 1, color: valueColor || 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-faint-solid)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default async function InvitesPage() {
  const user = await requireAuth();
  const supabase = createClient();
  const account = await getUserRow();
  const isBrand = account?.role === 'brand';

  // ═══════════════════ BRAND · INVITES SENT ═══════════════════
  if (isBrand) {
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    const admin = createAdminClient();
    const { data: invites } = brand
      ? await admin
          .from('campaign_invites')
          .select('*, campaigns(title), creator_profiles(id, users(display_name, avatar_url))')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false })
          .limit(100)
      : { data: [] };

    const list = invites || [];
    const pending = list.filter((i) => i.status === 'pending');
    const responded = list.filter((i) => i.status !== 'pending');
    const acceptedCount = list.filter((i) => i.status === 'accepted').length;
    const readyToFund = list
      .filter((i) => i.status === 'accepted')
      .reduce((sum, i) => sum + (i.proposed_rate || 0), 0);

    const brandRow = (inv: any) => {
      const creator = inv.creator_profiles as any;
      const name = creator?.users?.display_name || 'Creator';
      const muted = inv.status === 'declined' || inv.status === 'expired';
      // "Start collab" sends an accepted invite's brand to fund the collab in the
      // Collabs area (existing route — no new query/join added here).
      const action = inv.status === 'accepted'
        ? <Link href="/collabs" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Start collab →</Link>
        : inv.status === 'pending'
          ? <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>Awaiting reply</span>
          : <span style={{ fontSize: 12, color: '#B7BCC6' }}>Closed</span>;
      const sub = `${(inv.campaigns as any)?.title || 'Campaign'} · ${inv.proposed_rate > 0 ? formatSGD(inv.proposed_rate) : 'Barter'} · sent ${relativeTime(inv.created_at)}`;
      return { id: inv.id, name, creatorId: creator?.id, avatar: creator?.users?.avatar_url, muted, status: inv.status, sub, action };
    };

    const rows = (rowset: any[], isLastList: boolean) => rowset.map(brandRow);

    const DesktopTable = ({ items }: { items: ReturnType<typeof brandRow>[] }) => (
      <div className="cl-desktop card" style={{ padding: 0, overflow: 'hidden' }}>
        {items.map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 124px 150px', gap: 18, alignItems: 'center', padding: '15px 18px', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line)' }}>
            <Link href={r.creatorId ? `/creators/${r.creatorId}` : '#'} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none' }}>
              <Avatar src={r.avatar} name={r.name} size={40} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>
              </div>
            </Link>
            <div><StatusPill kind={PILL_KIND[r.status]} label={PILL_LABEL[r.status]} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{r.action}</div>
          </div>
        ))}
      </div>
    );
    const MobileCards = ({ items }: { items: ReturnType<typeof brandRow>[] }) => (
      <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {items.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            <Link href={r.creatorId ? `/creators/${r.creatorId}` : '#'} style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
              <Avatar src={r.avatar} name={r.name} size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: r.muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>
              </div>
              <StatusPill kind={PILL_KIND[r.status]} label={PILL_LABEL[r.status]} />
            </Link>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line)' }}>{r.action}</div>
          </div>
        ))}
      </div>
    );

    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 className="display-face" style={{ fontSize: 'clamp(23px,3vw,28px)', fontWeight: 700, letterSpacing: '-0.03em' }}>Invites sent</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 6 }}>Every creator you&apos;ve reached out to, and whether they&apos;ve said yes.</p>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={Send}
            title="You haven't invited anyone yet"
            body="Spot a creator you'd love to work with? Invite them straight from their profile. If they accept, your collab opens on the spot."
            actionHref="/creators"
            actionLabel="Browse creators"
          />
        ) : (
          <>
            {/* stat band — desktop */}
            <div className="cl-stats cl-desktop" style={{ display: 'grid' }}>
              <StatTile label="Invites sent" value={String(list.length)} />
              <StatTile label="Accepted" value={String(acceptedCount)} valueColor="var(--money-deep)" />
              <StatTile label="Awaiting reply" value={String(pending.length)} valueColor="var(--pending)" />
              <div style={{ background: 'var(--brand)', borderRadius: 14, padding: 18, color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>Ready to fund</span>
                  <span className="cl-pulse" style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--money)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={12} color="#fff" /></span>
                </div>
                <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{formatSGD(readyToFund)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--accent-on-dark)', marginTop: 7 }}>accepted invites, ready to protect</div>
              </div>
            </div>
            {/* stat band — mobile */}
            <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
              <div style={{ background: 'var(--brand)', borderRadius: 14, padding: 16, color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10 }}>Ready to fund</span>
                  <span className="cl-pulse" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--money)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={15} color="#fff" /></span>
                </div>
                <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1 }}>{formatSGD(readyToFund)}</div>
                <div style={{ fontSize: 12, color: 'var(--accent-on-dark)', marginTop: 7 }}>{acceptedCount} accepted invite{acceptedCount === 1 ? '' : 's'}, ready to protect</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <MobileChip value={String(list.length)} label="sent" />
                <MobileChip value={String(acceptedCount)} label="accepted" valueColor="var(--money-deep)" />
                <MobileChip value={String(pending.length)} label="awaiting" valueColor="var(--pending)" />
              </div>
            </div>

            {pending.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <SectionHead title="Awaiting response" count={pending.length} tone="pending" />
                <DesktopTable items={rows(pending, false)} />
                <MobileCards items={rows(pending, false)} />
              </div>
            )}
            {responded.length > 0 && (
              <div>
                <SectionHead title="Responded" count={responded.length} tone="muted" />
                <DesktopTable items={rows(responded, true)} />
                <MobileCards items={rows(responded, true)} />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ═══════════════════ CREATOR · INVITES RECEIVED ═══════════════════
  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id, boost_active_until, onboarding_completed_at')
    .eq('user_id', user.id)
    .single();
  const adminClient = createAdminClient();
  const { data: invites } = creator
    ? await adminClient
        .from('campaign_invites')
        .select('*, campaigns(id, title, brief), brand_profiles(company_name, logo_url)')
        .eq('creator_id', creator.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] };

  const list = invites || [];
  const pending = list.filter((i) => i.status === 'pending');
  const accepted = list.filter((i) => i.status === 'accepted');
  const rejected = list.filter((i) => i.status === 'declined' || i.status === 'expired');
  const pendingValue = pending.reduce((sum, i) => sum + (i.proposed_rate || 0), 0);

  // Compact row for the Accepted / Declined sections (works desktop + mobile).
  const pastCard = (inv: any) => {
    const brandName = (inv.brand_profiles as any)?.company_name || 'Brand';
    return (
      <div key={inv.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.92 }}>
        <Avatar src={(inv.brand_profiles as any)?.logo_url} name={brandName} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{brandName}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(inv.campaigns as any)?.title || 'Campaign'} · {inv.proposed_rate > 0 ? formatSGD(inv.proposed_rate) : 'Barter'} · {inv.responded_at ? relativeTime(inv.responded_at) : relativeTime(inv.created_at)}
          </div>
        </div>
        <StatusPill kind={PILL_KIND[inv.status]} label={PILL_LABEL[inv.status]} />
      </div>
    );
  };

  return (
    <div style={{ width: '100%' }}>
      <MarkInvitesSeen userId={user.id} />
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Inbound</div>
        <h1 className="display-face" style={{ fontSize: 'clamp(23px,3vw,28px)', fontWeight: 700, letterSpacing: '-0.03em' }}>Invites</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 6 }}>Brands that want to work with you. Accepting an invite creates the collaboration immediately.</p>
      </div>

      {boostUiEnabled() && creator?.onboarding_completed_at && (
        <div style={{ marginBottom: 18 }}>
          <BoostHint boostUntil={creator?.boost_active_until ?? null} preview={boostPreview()} />
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Brands will reach out right here"
          body="When a brand invites you to a campaign, it lands here with their offer attached. A complete profile with connected socials gets you discovered faster."
          actionHref="/profile"
          actionLabel="Polish your profile"
        />
      ) : (
        <>
          {/* stat band — desktop */}
          <div className="cl-stats cl-desktop" style={{ display: 'grid' }}>
            <StatTile label="Invites" value={String(list.length)} />
            <StatTile label="Pending" value={String(pending.length)} valueColor="var(--pending)" />
            <StatTile label="Accepted" value={String(accepted.length)} valueColor="var(--money-deep)" />
            <div style={{ background: 'var(--brand)', borderRadius: 14, padding: 18, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>Pending offers</span>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--money)' }} />
              </div>
              <div className="cl-stat-num" style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{pendingValue > 0 ? formatSGD(pendingValue) : '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--accent-on-dark)', marginTop: 7 }}>{pending.length} offer{pending.length === 1 ? '' : 's'} awaiting your reply</div>
            </div>
          </div>
          {/* stat band — mobile */}
          <div className="cl-mobile" style={{ display: 'none', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
            <div style={{ background: 'var(--brand)', borderRadius: 14, padding: 16, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10 }}>Pending offers</span>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--money)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1 }}>{pendingValue > 0 ? formatSGD(pendingValue) : '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-on-dark)', marginTop: 7 }}>{pending.length} offer{pending.length === 1 ? '' : 's'} awaiting your reply</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <MobileChip value={String(list.length)} label="invites" />
              <MobileChip value={String(pending.length)} label="pending" valueColor="var(--pending)" />
              <MobileChip value={String(accepted.length)} label="accepted" valueColor="var(--money-deep)" />
            </div>
          </div>

          {/* Pending — rich cards with accept/decline (logic preserved) */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <SectionHead title="Pending" count={pending.length} tone="pending" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {pending.map((inv) => {
                  const brandP = inv.brand_profiles as any;
                  const brandName = brandP?.company_name || 'A brand';
                  return (
                    <div key={inv.id} className="card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                        <Avatar src={brandP?.logo_url} name={brandName} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{brandName} invited you</p>
                            <span className="badge badge-warn"><Zap size={11} /> New</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {(inv.campaigns as any)?.title || 'a campaign'} · {relativeTime(inv.created_at)}
                          </p>
                        </div>
                        <span className="badge badge-money" style={{ flexShrink: 0, height: 28, paddingInline: 11, fontSize: 14, fontWeight: 600 }}>
                          {inv.proposed_rate > 0 ? (<><Shield size={13} /><span className="mono-num">{formatSGD(inv.proposed_rate)}</span></>) : 'Barter'}
                        </span>
                      </div>
                      {inv.message && (
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', margin: '13px 0 0' }}>
                          &ldquo;{inv.message}&rdquo;
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 13, marginTop: 13 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
                          {inv.proposed_rate > 0
                            ? `If you accept, ${brandName} secures the payment immediately.`
                            : 'If you accept, the barter collaboration starts right away.'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <Link href={`/jobs/${(inv.campaigns as any)?.id}`} className="btn-ghost btn-sm">View campaign</Link>
                          <InviteActions inviteId={inv.id} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {accepted.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <SectionHead title="Accepted" count={accepted.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{accepted.map(pastCard)}</div>
            </div>
          )}
          {rejected.length > 0 && (
            <div>
              <SectionHead title="Declined" count={rejected.length} tone="muted" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{rejected.map(pastCard)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
