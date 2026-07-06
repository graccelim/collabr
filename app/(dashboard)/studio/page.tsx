import { requireCreator } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { studioAccess } from '@/lib/entitlements';
import { flags } from '@/lib/flags';
import CreatorProShowcase from '@/components/studio/CreatorProShowcase';
import StudioTabs from '@/components/studio/StudioTabs';
import PostConnectSync from '@/components/studio/PostConnectSync';
import BackButton from '@/components/BackButton';
import BillingActions from '@/components/BillingActions';
import MockBanner from '@/components/MockBanner';
import { platformConnectable } from '@/lib/analytics/oauth';
import type { Platform } from '@/lib/analytics/adapters/types';
import { Lock } from 'lucide-react';

export default async function StudioPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  if (!flags.analyticsSuite) redirect('/dashboard');
  const user = await requireCreator();
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  const { data: sub } = creator
    ? await admin
        .from('creator_subscriptions')
        .select('status, pro_until')
        .eq('creator_id', creator.id)
        .maybeSingle()
    : { data: null };
  const access = studioAccess(sub);

  // Locked — never been Pro: entice with the upgrade card.
  if (access === 'locked' || !creator) {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton />
        {flags.creatorPro ? (
          <CreatorProShowcase returnTo="/studio" />
        ) : (
          <div
            className="card"
            style={{
              padding: 18,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <Lock
              size={18}
              style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }}
            />
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>
              Creator Studio is available with Creator Pro.
            </p>
          </div>
        )}
      </div>
    );
  }

  const readOnly = access === 'read_only';
  const tab = searchParams.tab || 'insights';

  // Data (own-row RLS / admin for owner-private tables).
  const [
    { data: accounts },
    { data: collabsRaw },
    { data: platformInsights },
    { data: reports },
    { data: socials },
  ] = await Promise.all([
    supabase
      .from('connected_accounts')
      .select('id, platform, status, last_synced_at, sync_frozen')
      .eq('creator_id', creator.id),
    admin
      .from('collabs')
      .select('id, campaigns(title)')
      .eq('creator_id', creator.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('creator_platform_insights')
      .select('platform, data, ai_narrative, ai_strategy')
      .eq('creator_id', creator.id),
    admin
      .from('ai_reports')
      .select('period_start, period_end, report')
      .eq('creator_id', creator.id)
      .order('period_end', { ascending: false })
      .limit(12),
    supabase
      .from('social_accounts')
      .select('platform')
      .eq('creator_id', creator.id),
  ]);
  const collabs = (collabsRaw ?? []).map((c) => ({
    id: c.id as string,
    title: ((c.campaigns as any)?.title as string) || 'Collaboration',
  }));
  // Content Lab tabs reflect the creator's OWN platforms (their social accounts),
  // not a hardcoded list. Ordered by the canonical platform order.
  const PLATFORM_ORDER = ['tiktok', 'instagram', 'youtube', 'lemon8', 'xiaohongshu', 'x'];
  const contentPlatforms = Array.from(new Set((socials ?? []).map((s) => s.platform as string)))
    .sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PostConnectSync accounts={(accounts ?? []).map((a) => ({ id: a.id as string, platform: a.platform as string, status: a.status as string }))} />
      <BackButton />
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>
            Creator Studio
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            Your private growth workspace.
          </p>
        </div>
        {/* "Cancel anytime" needs a real path: the Stripe portal handles payment
            method, invoices, and cancellation for Creator Pro. */}
        <BillingActions action="portal" label="Manage subscription" />
      </header>

      <MockBanner />

      {readOnly && (
        <div
          className="card"
          style={{
            padding: '13px 16px',
            background: 'var(--warn-tint)',
            border: '1px solid rgba(178,106,30,.22)',
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--warn-deep)',
            }}
          >
            Read-only, Creator Pro lapsed
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-soft)',
              margin: '2px 0 0',
            }}
          >
            Your historical analytics stay visible. Renew Creator Pro to resume
            syncing and new reports.
          </p>
        </div>
      )}

      <StudioTabs
        accounts={accounts ?? []}
        connectable={(['youtube', 'instagram', 'tiktok'] as Platform[]).filter(platformConnectable)}
        readOnly={readOnly}
        platformInsights={platformInsights ?? []}
        reports={reports ?? []}
        collabs={collabs}
        contentPlatforms={contentPlatforms}
        initial={tab}
      />
    </div>
  );
}
