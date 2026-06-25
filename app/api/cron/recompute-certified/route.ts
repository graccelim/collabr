import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { evaluateCertification, type CertFacts, type CertStatus } from '@/lib/certification/criteria'

// Nightly recompute of Collabr Certified 🛡️ (maintained + suspendable).
// Aggregation (windowed facts) is done in SQL; the earn/keep/suspend DECISION is
// the pure, tested engine in lib/certification/criteria.ts. Idempotent — a missed
// run self-heals. Does not touch payments/disputes/reviews/escrow/scores.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Dry-run: compute facts + decisions and report, but write NOTHING. Safe to
  // fire at staging to validate the SQL + engine before the first real run.
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const admin = createAdminClient()

  const { data: rows, error } = await admin.rpc('collabr_certification_facts', { p_creator_id: null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const certRows: Record<string, unknown>[] = []
  const nowCertified: string[] = []
  const notCertified: string[] = []

  for (const r of (rows ?? []) as Array<Record<string, number | string | null>>) {
    const completed = Number(r.completed_count ?? 0)
    const cancelled = Number(r.cancelled_count ?? 0)
    const disputes = Number(r.disputes_count ?? 0)
    const completionRate = completed + cancelled > 0 ? completed / (completed + cancelled) : null
    const disputeRate = completed > 0 ? disputes / completed : null

    const facts: CertFacts = {
      completed,
      reviews: Number(r.reviews_count ?? 0),
      ratingAvg: Number(r.rating_avg ?? 0),
      completionRate,
      disputeRate,
      unresolvedDisputes: Number(r.unresolved_disputes ?? 0),
      responseMedianHours: r.response_median_hours == null ? null : Number(r.response_median_hours),
    }
    const result = evaluateCertification(facts, (r.current_status as CertStatus) ?? 'none')
    const creatorId = String(r.creator_id)

    certRows.push({
      creator_id: creatorId,
      status: result.status,
      criteria: result.criteria,
      suspended_reason: result.suspendedReason,
      window_label: '90d_or_last_20',
      completed_count: completed,
      reviews_count: facts.reviews,
      rating_avg: facts.ratingAvg,
      completion_rate: completionRate,
      dispute_rate: disputeRate,
      unresolved_disputes: facts.unresolvedDisputes,
      response_median_hours: facts.responseMedianHours,
      repeat_brands: Number(r.repeat_brands ?? 0),
      evaluated_at: new Date().toISOString(),
    })
    ;(result.certified ? nowCertified : notCertified).push(creatorId)
  }

  if (dry) {
    // No writes. Report what WOULD change + a small sample for eyeballing.
    const sample = certRows.slice(0, 10).map((r) => ({
      creator_id: r.creator_id,
      status: r.status,
      suspended_reason: r.suspended_reason,
      completed: r.completed_count,
      reviews: r.reviews_count,
      rating_avg: r.rating_avg,
      completion_rate: r.completion_rate,
      dispute_rate: r.dispute_rate,
      unresolved_disputes: r.unresolved_disputes,
    }))
    return NextResponse.json({
      dry_run: true,
      evaluated: certRows.length,
      would_certify: nowCertified.length,
      would_not_certify: notCertified.length,
      sample,
    })
  }

  // Private detail rows (criteria/reason/facts) — one upsert.
  if (certRows.length) {
    const { error: upErr } = await admin.from('collabr_certification').upsert(certRows, { onConflict: 'creator_id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // Public badge boolean — two bulk updates (only the flag lives on the profile).
  if (nowCertified.length) {
    const { error: e1 } = await admin.from('creator_profiles').update({ certified: true }).in('id', nowCertified)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  }
  if (notCertified.length) {
    const { error: e2 } = await admin.from('creator_profiles').update({ certified: false }).in('id', notCertified)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({
    evaluated: certRows.length,
    certified: nowCertified.length,
    not_certified: notCertified.length,
  })
}
