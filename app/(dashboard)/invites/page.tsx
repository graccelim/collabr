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
import ListWorkspace, { type LWItem, type LWTile, type LWStatus } from '@/components/ListWorkspace';
import { boostUiEnabled, boostPreview } from '@/lib/stripe';
import { Send, Mail, Zap, Shield } from 'lucide-react';

const PILL_KIND: Record<string, StatusPillKind> = { pending: 'pending', accepted: 'accepted', declined: 'declined', expired: 'expired' };
const PILL_LABEL: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };
// Collapse expired into the "declined" filter bucket.
const filterKey = (status: string) => (status === 'expired' ? 'declined' : status);
const ms = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);

export default async function InvitesPage() {
  const user = await requireAuth();
  const supabase = createClient();
  const account = await getUserRow();
  const isBrand = account?.role === 'brand';

  // ═══════════════════ BRAND · INVITES SENT ═══════════════════
  if (isBrand) {
    const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single();
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
    const acceptedCount = list.filter((i) => i.status === 'accepted').length;
    const pendingCount = list.filter((i) => i.status === 'pending').length;
    const readyToFund = list.filter((i) => i.status === 'accepted').reduce((s, i) => s + (i.proposed_rate || 0), 0);

    const item = (inv: any): LWItem => {
      const creator = inv.creator_profiles as any;
      const name = creator?.users?.display_name || 'Creator';
      const muted = inv.status === 'declined' || inv.status === 'expired';
      const href = creator?.id ? `/creators/${creator.id}` : '#';
      const sub = `${(inv.campaigns as any)?.title || 'Campaign'} · ${inv.proposed_rate > 0 ? formatSGD(inv.proposed_rate) : 'Barter'} · sent ${relativeTime(inv.created_at)}`;
      // "Start collab" sends the brand to fund the accepted collab in Collabs
      // (existing route — no new query/join here).
      const action = inv.status === 'accepted'
        ? <Link href="/collabs" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Start collab →</Link>
        : inv.status === 'pending'
          ? <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>Awaiting reply</span>
          : <span style={{ fontSize: 12, color: '#B7BCC6' }}>Closed</span>;
      const desktop = (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 124px 150px', gap: 18, alignItems: 'center', padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
          <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none' }}>
            <Avatar src={creator?.users?.avatar_url} name={name} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
            </div>
          </Link>
          <div><StatusPill kind={PILL_KIND[inv.status]} label={PILL_LABEL[inv.status]} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{action}</div>
        </div>
      );
      const mobile = (
        <div className="card" style={{ padding: 14 }}>
          <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <Avatar src={creator?.users?.avatar_url} name={name} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: muted ? 'var(--ink-faint-solid)' : 'var(--ink)' }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
            </div>
            <StatusPill kind={PILL_KIND[inv.status]} label={PILL_LABEL[inv.status]} />
          </Link>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line)' }}>{action}</div>
        </div>
      );
      return { id: inv.id, status: filterKey(inv.status), amountCents: inv.proposed_rate || 0, createdAt: ms(inv.created_at), needsAction: inv.status === 'accepted', campaign: (inv.campaigns as any)?.title, desktop, mobile };
    };

    const tiles: LWTile[] = [
      { label: 'Invites sent', value: String(list.length) },
      { label: 'Accepted', value: String(acceptedCount), valueColor: 'var(--money-deep)', filter: ['accepted'] },
      { label: 'Awaiting reply', value: String(pendingCount), valueColor: 'var(--pending)', filter: ['pending'] },
      { label: 'Ready to fund', value: formatSGD(readyToFund), hero: true, heroIcon: 'shield', heroSub: 'accepted invites, ready to protect' },
    ];
    const statuses: LWStatus[] = [
      { key: 'pending', label: 'Pending', dot: 'var(--pending)' },
      { key: 'accepted', label: 'Accepted', dot: 'var(--money)' },
      { key: 'declined', label: 'Declined', dot: '#B7BCC6' },
    ];

    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 className="display-face" style={{ fontSize: 'clamp(23px,3vw,28px)', fontWeight: 700, letterSpacing: '-0.03em' }}>Invites sent</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 6 }}>Every creator you&apos;ve reached out to, and whether they&apos;ve said yes.</p>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={Send} title="You haven't invited anyone yet" body="Spot a creator you'd love to work with? Invite them straight from their profile. If they accept, your collab opens on the spot." actionHref="/creators" actionLabel="Browse creators" />
        ) : (
          <ListWorkspace tiles={tiles} statuses={statuses} sorts={['recent', 'amount']} items={list.map(item)} emptyLabel="No invites match these filters." />
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
  const pendingCount = list.filter((i) => i.status === 'pending').length;
  const acceptedCount = list.filter((i) => i.status === 'accepted').length;
  const pendingValue = list.filter((i) => i.status === 'pending').reduce((s, i) => s + (i.proposed_rate || 0), 0);

  const pendingCard = (inv: any) => {
    const brandP = inv.brand_profiles as any;
    const brandName = brandP?.company_name || 'A brand';
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <Avatar src={brandP?.logo_url} name={brandName} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{brandName} invited you</p>
              <span className="badge badge-warn"><Zap size={11} /> New</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{(inv.campaigns as any)?.title || 'a campaign'} · {relativeTime(inv.created_at)}</p>
          </div>
          <span className="badge badge-money" style={{ flexShrink: 0, height: 28, paddingInline: 11, fontSize: 14, fontWeight: 600 }}>
            {inv.proposed_rate > 0 ? (<><Shield size={13} /><span className="mono-num">{formatSGD(inv.proposed_rate)}</span></>) : 'Barter'}
          </span>
        </div>
        {inv.message && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', margin: '13px 0 0' }}>&ldquo;{inv.message}&rdquo;</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 13, marginTop: 13 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
            {inv.proposed_rate > 0 ? `If you accept, ${brandName} secures the payment immediately.` : 'If you accept, the barter collaboration starts right away.'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/jobs/${(inv.campaigns as any)?.id}`} className="btn-ghost btn-sm">View campaign</Link>
            <InviteActions inviteId={inv.id} />
          </div>
        </div>
      </div>
    );
  };

  const pastCard = (inv: any) => {
    const brandName = (inv.brand_profiles as any)?.company_name || 'Brand';
    return (
      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.92 }}>
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

  const items: LWItem[] = list.map((inv) => {
    const node = inv.status === 'pending' ? pendingCard(inv) : pastCard(inv);
    return { id: inv.id, status: filterKey(inv.status), amountCents: inv.proposed_rate || 0, createdAt: ms(inv.responded_at || inv.created_at), needsAction: inv.status === 'pending', campaign: (inv.campaigns as any)?.title, desktop: node, mobile: node };
  });
  const tiles: LWTile[] = [
    { label: 'Invites', value: String(list.length) },
    { label: 'Pending', value: String(pendingCount), valueColor: 'var(--pending)', filter: ['pending'] },
    { label: 'Accepted', value: String(acceptedCount), valueColor: 'var(--money-deep)', filter: ['accepted'] },
    { label: 'Pending offers', value: pendingValue > 0 ? formatSGD(pendingValue) : '—', hero: true, heroIcon: 'dot', heroSub: `${pendingCount} offer${pendingCount === 1 ? '' : 's'} awaiting your reply` },
  ];
  const statuses: LWStatus[] = [
    { key: 'pending', label: 'Pending', dot: 'var(--pending)' },
    { key: 'accepted', label: 'Accepted', dot: 'var(--money)' },
    { key: 'declined', label: 'Declined', dot: '#B7BCC6' },
  ];

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
        <EmptyState icon={Mail} title="Brands will reach out right here" body="When a brand invites you to a campaign, it lands here with their offer attached. A complete profile with connected socials gets you discovered faster." actionHref="/profile" actionLabel="Polish your profile" />
      ) : (
        <ListWorkspace tiles={tiles} statuses={statuses} sorts={['recent', 'amount']} items={items} variant="cards" emptyLabel="No invites match these filters." />
      )}
    </div>
  );
}
