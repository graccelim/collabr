import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { collabResultSchema } from '@/lib/results/report'

// Creator self-reports their post's real metrics for a completed/live collab.
// Compliant (no scraping), free. Upserts one collab_results row per collab.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('id, status, creator_id, brand_id, campaign_id, creator_profiles(user_id, users(display_name)), brand_profiles(user_id, users(email)), campaigns(title)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (creatorUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Results only make sense once the content is live.
  if (!['live_submitted', 'live_confirmed', 'completed'].includes(collab.status)) {
    return NextResponse.json({ error: 'You can add results once your content is live.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = collabResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check your numbers.' }, { status: 400 })
  }
  const v = parsed.data

  const admin = createAdminClient()
  // The post link was already captured at the live-post step; reuse it so we never
  // ask the creator for it twice.
  const { data: livePost } = await admin.from('live_posts').select('post_url').eq('collab_id', params.id).maybeSingle()
  const { error } = await admin.from('collab_results').upsert({
    collab_id: params.id,
    creator_id: collab.creator_id,
    brand_id: collab.brand_id,
    campaign_id: collab.campaign_id,
    views: v.views ?? null, likes: v.likes ?? null, comments: v.comments ?? null,
    shares: v.shares ?? null, saves: v.saves ?? null,
    post_url: livePost?.post_url ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'collab_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Let the brand know their results are in (best effort).
  const brandUserId = (collab.brand_profiles as any)?.user_id
  const brandEmail = (collab.brand_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Your creator'
  const campaignTitle = (collab.campaigns as any)?.title || 'your campaign'
  if (brandUserId) {
    await sendNotification({
      userId: brandUserId, type: 'results_reported',
      title: `${creatorName} shared their results`,
      body: `See how "${campaignTitle}" performed.`,
      payload: { collab_id: params.id },
      dedupeKey: `collab:${params.id}:results-reported:${new Date().toISOString().slice(0, 10)}`,
    })
    if (brandEmail) {
      await sendProductEmail({ to: brandEmail, ...productEmails.resultsReported({ creatorName, campaignTitle, collabId: params.id }) })
    }
  }

  return NextResponse.json({ success: true })
}
