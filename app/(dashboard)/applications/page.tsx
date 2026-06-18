import { createClient } from '@/lib/supabase/server';
import { requireCreator } from '@/lib/auth';
import Link from 'next/link';
import { formatSGD } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { Send } from 'lucide-react';
import { creatorApplicationState, CREATOR_APP_LABEL } from '@/lib/collab-status';

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

  const collabByApp: Record<string, { id: string; payment_status: string; status: string }> = {};
  if (selectedAppIds.length > 0) {
    const { data: collabs } = await supabase
      .from('collabs')
      .select('id, application_id, payment_status, status')
      .in('application_id', selectedAppIds);
    collabs?.forEach((c) => {
      if (c.application_id) collabByApp[c.application_id] = { id: c.id, payment_status: c.payment_status, status: c.status };
    });
  }

  const STATE_BADGE: Record<string, string> = { applied: 'badge-gray', confirmed: 'badge-teal' };

  const active = (applications || []).filter(
    (a) => !['rejected'].includes(a.status)
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
          body="Apply to a campaign and you'll see it land here. The moment a brand picks you, you'll know."
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
              const href = confirmed && collab
                ? `/collabs/${collab.id}`
                : `/jobs/${campaign?.id}`;
              return (
                <Link
                  key={app.id}
                  href={href}
                  className="card card-hover block"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {campaign?.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {campaign?.brand_profiles?.company_name}
                      </div>
                      {(campaign?.budget_min || campaign?.budget_max) && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {campaign.budget_min
                            ? formatSGD(campaign.budget_min)
                            : '-'}
                          {campaign.budget_max
                            ? ` – ${formatSGD(campaign.budget_max)}`
                            : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge ${STATE_BADGE[state] || 'badge-gray'}`}>
                        {CREATOR_APP_LABEL[state]}
                      </span>
                      {confirmed && (
                        <span
                          className="btn-primary btn-sm"
                          style={{ pointerEvents: 'none' }}
                        >
                          View collab →
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
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
