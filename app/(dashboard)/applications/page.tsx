import { createClient } from '@/lib/supabase/server';
import { requireCreator } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { Send } from 'lucide-react';
import { creatorApplicationState, CREATOR_APP_LABEL } from '@/lib/collab-status';
import WithdrawApplicationButton from '@/components/WithdrawApplicationButton';

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
      // Skip cancelled collabs: after an undo/expiry + re-select an application
      // can have a dead collab alongside the live one — map to the live one.
      if (c.application_id && c.status !== 'cancelled') collabByApp[c.application_id] = { id: c.id, payment_status: c.payment_status, status: c.status, agreed_rate: c.agreed_rate, from_invite: !!c.from_invite };
    });
  }

  const STATE_BADGE: Record<string, string> = { applied: 'badge-gray', confirmed: 'badge-teal' };

  const active = (applications || []).filter(
    (a) => !['rejected', 'withdrawn'].includes(a.status)
  );
  const past = (applications || []).filter((a) => a.status === 'rejected');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="eyebrow" style={{ marginBottom: 7 }}>
          Outbound
        </div>
        <h1 style={{ fontSize: 28 }}>My applications</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
          Keep track of every opportunity you've applied to and its current
          status.
        </p>
      </div>

      {(!applications || applications.length === 0) && (
        <EmptyState
          icon={Send}
          title="Your pitches show up here"
          body="Campaigns you apply to will appear here."
          actionHref="/jobs"
          actionLabel="Browse campaigns"
        />
      )}

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Active ({active.length})
          </h2>
          <div className="space-y-2">
            {active.map((app) => {
              const campaign = app.campaigns as any;
              const collab = collabByApp[app.id];
              // Creator-facing state: selected-but-unfunded reads "Applied" and
              // does NOT expose the collab; only a funded collab is "Confirmed".
              const state = creatorApplicationState(app.status, collab);
              const confirmed = state === 'confirmed';
              // Invite-accepted collabs are visible to the creator pre-funding —
              // they read "Invite accepted" and link to the collab (not "Applied").
              const inviteAccepted = !!collab?.from_invite && !confirmed;
              const showsCollab = (confirmed || inviteAccepted) && !!collab;
              const href = showsCollab && collab
                ? `/collabs/${collab.id}`
                : `/jobs/${campaign?.id}`;
              const info = (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {campaign?.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {campaign?.brand_profiles?.company_name}
                  </div>
                  {(campaign?.budget_min || campaign?.budget_max) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {campaign.budget_min ? formatSGD(campaign.budget_min) : '-'}
                      {campaign.budget_max ? ` – ${formatSGD(campaign.budget_max)}` : ''}
                    </div>
                  )}
                </div>
              );
              const badge = (
                <span className={`badge ${inviteAccepted ? 'badge-teal' : STATE_BADGE[state] || 'badge-gray'}`}>
                  {inviteAccepted
                    ? 'Invite accepted'
                    : confirmed && collab?.agreed_rate === 0 ? 'Confirmed' : CREATOR_APP_LABEL[state]}
                </span>
              );
              // Confirmed / invite-accepted → whole card links to the collab.
              // Applied (still open) → card links to the campaign, with a Withdraw
              // control alongside (kept OUTSIDE the link, not a nested interactive).
              if (showsCollab) {
                return (
                  <Link key={app.id} href={href} className="card card-hover block">
                    <div className="flex items-center justify-between gap-3">
                      {info}
                      <div className="flex items-center gap-2 shrink-0">
                        {badge}
                        <span className="btn-primary btn-sm" style={{ pointerEvents: 'none' }}>
                          View collab →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              }
              return (
                <div key={app.id} className="card">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={href} className="flex-1 min-w-0 block">
                      {info}
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      {badge}
                      <WithdrawApplicationButton applicationId={app.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Not selected ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((app) => {
              const campaign = app.campaigns as any;
              return (
                <div key={app.id} className="card opacity-60">
                  <div className="text-sm font-medium text-gray-900">
                    {campaign?.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {campaign?.brand_profiles?.company_name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
