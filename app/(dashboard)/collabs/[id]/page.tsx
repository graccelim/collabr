import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { formatSGD, COLLAB_STATUSES } from '@/lib/utils'
import CollabActions from '@/components/CollabActions'

export default async function CollabDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isBrand = profile?.role === 'brand'

  const { data: collab } = await supabase.from('collabs')
    .select(`
      *,
      campaigns(title, brief, deliverable_types),
      creator_profiles(id, bio, rating_avg, rating_count, stripe_connect_id, users(display_name, email, avatar_url)),
      brand_profiles(id, company_name, user_id)
    `)
    .eq('id', params.id).single()

  if (!collab) return <p className="text-sm text-gray-500">Collab not found.</p>

  // Authorise: only the brand or creator on this collab may view it
  const brandUserId = (collab.brand_profiles as any)?.user_id
  const { data: creatorProfile } = await supabase.from('creator_profiles').select('user_id').eq('id', collab.creator_id).single()
  if (brandUserId !== user.id && creatorProfile?.user_id !== user.id) {
    return <p className="text-sm text-red-500">You don't have access to this collab.</p>
  }

  const { data: submissions } = await supabase.from('submissions')
    .select('*').eq('collab_id', params.id).order('version', { ascending: false })

  const { data: livePost } = await supabase.from('live_posts')
    .select('*').eq('collab_id', params.id).maybeSingle()

  const status = COLLAB_STATUSES[collab.status as keyof typeof COLLAB_STATUSES]
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'
  const creatorHasConnect = !!(collab.creator_profiles as any)?.stripe_connect_id

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{collab.campaigns?.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isBrand ? creatorName : (collab.brand_profiles as any)?.company_name}
          </p>
        </div>
        <span className={`badge badge-${status?.color || 'gray'}`}>{status?.label || collab.status}</span>
      </div>

      {/* Financial summary */}
      <div className="card grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-gray-900">{formatSGD(collab.agreed_rate)}</div>
          <div className="text-xs text-gray-500">Campaign budget</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{formatSGD(collab.platform_fee)}</div>
          <div className="text-xs text-gray-500">Platform fee</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-teal-600">{formatSGD(collab.creator_payout)}</div>
          <div className="text-xs text-gray-500">Creator payout</div>
        </div>
      </div>

      {/* Actions — brand pay / confirm; creator submit */}
      <CollabActions
        collabId={params.id}
        collabStatus={collab.status}
        isBrand={isBrand}
        agreedRate={collab.agreed_rate}
        creatorName={creatorName}
        stripePaymentIntentId={collab.stripe_payment_intent_id}
        creatorHasConnect={creatorHasConnect}
        livePostUrl={livePost?.post_url || null}
      />

      {/* Brief */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Brief</h2>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{collab.campaigns?.brief}</p>
        {collab.campaigns?.deliverable_types && (
          <div className="flex flex-wrap gap-1 mt-3">
            {collab.campaigns.deliverable_types.map((d: string) => (
              <span key={d} className="badge badge-gray">{d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Submissions */}
      {submissions && submissions.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Draft submissions</h2>
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Version {s.version}</span>
                  <span className={`badge badge-${s.decision === 'approved' ? 'teal' : s.decision === 'revision' ? 'amber' : 'gray'}`}>
                    {s.decision}
                  </span>
                </div>
                {s.creator_note && <p className="text-xs text-gray-600">Note: {s.creator_note}</p>}
                {s.file_url && (
                  <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-purple-600 underline">View draft →</a>
                )}
                {s.brand_feedback && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-xs text-amber-700">Feedback: {s.brand_feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live post */}
      {livePost && (
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-2">Live post</h2>
          <a href={livePost.post_url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-purple-600 underline break-all">{livePost.post_url}</a>
          {livePost.confirmed_at && (
            <p className="text-xs text-teal-600 mt-1">
              Confirmed {new Date(livePost.confirmed_at).toLocaleDateString('en-SG')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
