import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

// Daily: nudge creators to report results for collabs that completed ~14 days ago
// and still have no reported numbers. Marks results_reminded_at so it fires once.
export const runtime = 'nodejs'
const REMINDER_DAYS = Number(process.env.RESULTS_REMINDER_DAYS) || 14

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - REMINDER_DAYS * 86_400_000).toISOString()
  const key = new Date().toISOString().slice(0, 10)

  const { data: collabs } = await admin.from('collabs')
    .select('id, campaigns(title), creator_profiles(user_id, users(email, display_name)), brand_profiles(company_name), collab_results(collab_id)')
    .eq('status', 'completed')
    .lte('completed_at', cutoff)
    .is('results_reminded_at', null)
    .limit(200)

  let reminded = 0
  for (const c of collabs ?? []) {
    const nowIso = new Date().toISOString()
    const cr = (c as any).collab_results
    const alreadyReported = Array.isArray(cr) ? cr.length > 0 : cr != null
    // Mark as handled either way so we don't re-scan it daily.
    if (alreadyReported) {
      await admin.from('collabs').update({ results_reminded_at: nowIso }).eq('id', c.id)
      continue
    }
    const creatorUserId = (c as any).creator_profiles?.user_id
    const email = (c as any).creator_profiles?.users?.email
    const brandName = (c as any).brand_profiles?.company_name || 'the brand'
    if (creatorUserId) {
      await sendNotification({
        userId: creatorUserId, type: 'results_reminder',
        title: 'How did your post do?',
        body: `Add your results for ${brandName} so they can see how it performed.`,
        payload: { collab_id: c.id },
        dedupeKey: `collab:${c.id}:results-reminder`,
      })
    }
    if (email) await sendProductEmail({ to: email, userId: creatorUserId, ...productEmails.resultsReminder({ brandName, collabId: c.id as string, key }) })
    await admin.from('collabs').update({ results_reminded_at: nowIso }).eq('id', c.id)
    reminded++
  }

  return NextResponse.json({ ok: true, reminded })
}
