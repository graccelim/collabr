import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAuth, getUserRow } from '@/lib/auth';
import { formatSGD, COLLAB_STATUSES, getInitials } from '@/lib/utils';
import { deriveWorkflow, actorLabel, escrowStep } from '@/lib/workflow';
import { isPaymentSecured } from '@/lib/collab-status';
import EmptyState from '@/components/EmptyState';
import CollabsList, { type CollabRowData } from '@/components/CollabsList';
import { Briefcase, Compass, Megaphone } from 'lucide-react';
import Link from 'next/link';

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

  // Creators only see a collab once escrow is secured — a briefed, unfunded
  // collab is invisible to them (their application still reads "Applied").
  const visibleCollabs = (collabs || []).filter(
    (c) => isBrand || c.status !== 'briefed' || isPaymentSecured(c.payment_status)
  );

  // Build display rows + filter bucket (Needs you / In progress / Completed)
  // server-side; the chip filtering happens client-side in <CollabsList>.
  const rows: CollabRowData[] = visibleCollabs.map((c) => {
    const counterparty = isBrand
      ? (c.creator_profiles as any)?.users?.display_name || 'Creator'
      : (c.brand_profiles as any)?.company_name || 'Brand';
    const view = deriveWorkflow({
      status: c.status,
      paymentStatus: c.payment_status,
      isBrand,
      counterpartName: counterparty,
    });
    const turn = actorLabel(view, isBrand, counterparty);
    const done = ['completed', 'cancelled'].includes(c.status);
    const statusLabel =
      COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label ||
      c.status;
    return {
      id: c.id,
      counterparty,
      initials: getInitials(counterparty),
      campaignTitle: c.campaigns?.title || 'Campaign',
      step: escrowStep(c.status, c.payment_status),
      statusLabel: turn.yourTurn ? `${statusLabel} · your turn` : statusLabel,
      statusColor:
        c.status === 'disputed'
          ? 'var(--danger)'
          : turn.yourTurn
            ? 'var(--warn)'
            : 'var(--ink-faint-solid)',
      amount: formatSGD(c.agreed_rate),
      bucket: done ? 'completed' : turn.yourTurn ? 'needs' : 'progress',
      dimmed: done,
    };
  });

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Collaborations
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          {isBrand
            ? 'Review content, share feedback, and keep every collaboration on track.'
            : 'Manage drafts, approvals, and payments for every collaboration.'}
        </p>
      </div>

      {rows.length > 0 ? (
        <>
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
          body={
            isBrand
              ? 'Pick a creator on one of your campaigns and we’ll lock the payment in escrow, then everything you’re running shows up here.'
              : 'Start collaborating with brands and get paid for content you love making. Apply to a campaign and your collab opens right here.'
          }
          actionHref={isBrand ? '/campaigns' : '/jobs'}
          actionLabel={isBrand ? 'Go to campaigns' : 'Discover campaigns'}
        />
      )}
    </div>
  );
}
