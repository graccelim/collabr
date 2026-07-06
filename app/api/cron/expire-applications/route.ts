import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { consumesSpot } from '@/lib/collab-status'
import { NextRequest, NextResponse } from 'next/server'

// Guarantees every applicant a DEFINITE answer instead of being ghosted.
// Auto-declines open applications (pending / shortlisted) when:
//   • the campaign filled all its creator slots, or
//   • the campaign was closed/completed, or
//   • the campaign deadline passed, or
//   • the application has waited too long with no decision. Pending expires at
//     14 days; a SHORTLISTED application is being actively considered, so it
//     gets a longer 30-day window before it too expires (it never lingers
//     forever — this is the shortlist's expiry path).
// Idempotent + gentle (reuses the standard "not selected" notification + email).
const PENDING_MAX_DAYS = 14
const SHORTLIST_MAX_DAYS = 30

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10) // YYYY-MM-DD vs campaigns.deadline (date)

  const { data: open } = await admin.from('applications')
    .select('id, status, created_at, campaign_id, campaigns(id, title, status, deadline, creators_needed), creator_profiles(user_id, users(email))')
    .in('status', ['pending', 'shortlisted'])
  if (!open || open.length === 0) return NextResponse.json({ declined: 0 })

  // How many slots each campaign has already filled. A slot is only consumed
  // once escrow is secured (funded) — a selected-but-unfunded collab does not
  // count, so applicants aren't declined before any real commitment exists.
  const campaignIds = Array.from(new Set(open.map(a => a.campaign_id).filter(Boolean)))
  const filled: Record<string, number> = {}
  if (campaignIds.length > 0) {
    const { data: collabs } = await admin.from('collabs')
      .select('campaign_id, status, payment_status').in('campaign_id', campaignIds)
    for (const c of collabs || []) {
      if (consumesSpot(c)) filled[c.campaign_id] = (filled[c.campaign_id] || 0) + 1
    }
  }

  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / 86_400_000

  const toDecline: { id: string; userId?: string; email?: string; title: string }[] = []
  for (const app of open) {
    const camp = app.campaigns as any
    if (!camp) continue
    const isFilled = (filled[camp.id] || 0) >= (camp.creators_needed || 1)
    const isClosed = ['closed', 'completed'].includes(camp.status)
    const deadlinePassed = camp.deadline && camp.deadline < today
    const stale = app.status === 'pending'
      ? ageDays(app.created_at) >= PENDING_MAX_DAYS
      : ageDays(app.created_at) >= SHORTLIST_MAX_DAYS
    if (isFilled || isClosed || deadlinePassed || stale) {
      toDecline.push({
        id: app.id,
        userId: (app.creator_profiles as any)?.user_id,
        email: (app.creator_profiles as any)?.users?.email,
        title: camp.title || 'a campaign',
      })
    }
  }

  if (toDecline.length === 0) return NextResponse.json({ declined: 0 })

  // Notify ONLY the rows this update actually rejected: an applicant selected
  // between the read and the write must not get a rejection email, and if the
  // write fails nobody should hear about a rejection that never happened.
  const { data: rejectedRows, error: rejectErr } = await admin.from('applications')
    .update({ status: 'rejected' })
    .in('id', toDecline.map(d => d.id))
    .in('status', ['pending', 'shortlisted']) // guard: don't touch ones since selected
    .select('id')
  if (rejectErr) {
    console.error('[CRON expire-applications] reject update failed:', rejectErr.message)
    return NextResponse.json({ declined: 0, error: rejectErr.message }, { status: 500 })
  }
  const rejectedIds = new Set((rejectedRows || []).map(r => r.id))

  let notified = 0
  for (const d of toDecline) {
    if (!rejectedIds.has(d.id)) continue
    if (d.userId) {
      await sendNotification({
        userId: d.userId,
        type: 'application_rejected',
        title: `Application closed for "${d.title}"`,
        body: 'This campaign is no longer accepting applicants. Thanks for applying, new campaigns are posted regularly.',
        payload: { application_id: d.id },
        dedupeKey: `application:${d.id}:rejected`,
        email: false,
      })
      notified++
    }
    if (d.email) {
      await sendProductEmail({ to: d.email, ...productEmails.applicationRejected({ campaignTitle: d.title, applicationId: d.id }) })
    }
  }

  return NextResponse.json({ declined: rejectedIds.size, notified })
}
