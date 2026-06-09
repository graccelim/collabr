import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatSGD } from '@/lib/utils'
import Link from 'next/link'
import DisputeResolutionForm from '@/components/DisputeResolutionForm'

export default async function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: dispute } = await admin.from('disputes')
    .select('*, collabs(id, agreed_rate, creator_payout, platform_fee, stripe_payment_intent_id, campaigns(title, brief), creator_profiles(users(display_name, email)), brand_profiles(company_name, users(email)))')
    .eq('id', params.id).single()

  if (!dispute) return <p className="text-sm text-red-500">Dispute not found.</p>

  const collab = dispute.collabs as any
  const isResolved = dispute.outcome !== 'pending'

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/disputes" className="text-xs text-gray-400 hover:text-gray-600">← All disputes</Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dispute</h1>
        <span className={`badge ${isResolved ? 'badge-teal' : 'badge-amber'}`}>
          {isResolved ? dispute.outcome?.replace(/_/g, ' ') : 'Pending'}
        </span>
      </div>

      {/* Collab details */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Collab details</h2>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-500">Campaign:</span> {collab?.campaigns?.title}</p>
          <p><span className="text-gray-500">Brand:</span> {collab?.brand_profiles?.company_name} ({collab?.brand_profiles?.users?.email})</p>
          <p><span className="text-gray-500">Creator:</span> {collab?.creator_profiles?.users?.display_name} ({collab?.creator_profiles?.users?.email})</p>
          <p><span className="text-gray-500">Amount:</span> {formatSGD(collab?.agreed_rate || 0)} total · {formatSGD(collab?.creator_payout || 0)} to creator</p>
          {collab?.stripe_payment_intent_id && (
            <p><span className="text-gray-500">Payment intent:</span> <code className="text-xs bg-surface px-1 rounded">{collab.stripe_payment_intent_id}</code></p>
          )}
        </div>
      </div>

      {/* Dispute reason + evidence */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Dispute filed by {dispute.raised_by}</h2>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{dispute.reason}</p>
        {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-gray-500">Evidence</p>
            {dispute.evidence_urls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-600 underline block">
                Evidence {i + 1} →
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Campaign brief context */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Campaign brief</h2>
        <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-6">{collab?.campaigns?.brief}</p>
      </div>

      {/* Resolution */}
      {isResolved ? (
        <div className="card bg-teal-50 border-teal-200">
          <p className="text-sm font-medium text-teal-700">Resolved: {dispute.outcome?.replace(/_/g, ' ')}</p>
          {dispute.split_percentage && (
            <p className="text-xs text-teal-600 mt-1">Split: {dispute.split_percentage}% / {100 - dispute.split_percentage}%</p>
          )}
          {dispute.platform_ruling && (
            <p className="text-sm text-teal-600 mt-2">{dispute.platform_ruling}</p>
          )}
        </div>
      ) : (
        <DisputeResolutionForm
          disputeId={params.id}
          agreedRate={collab?.agreed_rate || 0}
        />
      )}
    </div>
  )
}
