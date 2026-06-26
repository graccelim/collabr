import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { youtubeApiKey } from '@/lib/analytics/oauth'
import { isCreatorProActive } from '@/lib/creator-pro'
import { checkRateLimit } from '@/lib/rate-limit'

// Connect a YouTube channel via PUBLIC stats (Data API v3 + API key) — no OAuth,
// no app review. Creator submits a channel id (UC…) or @handle; we resolve the
// channel id and store it. The sync cron pulls public stats with the API key.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!flags.connectedCreator) return NextResponse.json({ error: 'Not available' }, { status: 503 })

  const key = youtubeApiKey()
  if (!key) return NextResponse.json({ error: 'YouTube is not configured yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.json({ error: 'Connecting accounts requires Creator Pro.' }, { status: 403 })
  }
  if (!checkRateLimit(`connect-yt:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const raw = String(body?.channel || '').trim()
  if (!raw) return NextResponse.json({ error: 'Enter your channel ID or @handle.' }, { status: 400 })

  // Resolve to a channel id + title (channel id passed straight through; handle resolved).
  try {
    let channelId: string | null = null
    let title: string | null = null
    const idMatch = raw.match(/UC[\w-]{20,}/)
    const handle = raw.replace(/^.*@/, '@').match(/@[\w.-]+/)?.[0]
    const q = idMatch
      ? new URLSearchParams({ part: 'snippet', id: idMatch[0], key })
      : new URLSearchParams({ part: 'snippet', forHandle: (handle || raw).replace(/^@/, ''), key })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${q}`)
    const d: any = await res.json()
    const it = d?.items?.[0]
    channelId = it?.id ?? (idMatch ? idMatch[0] : null)
    title = it?.snippet?.title ?? null
    if (!channelId) return NextResponse.json({ error: 'Could not find that channel. Check the ID or @handle.' }, { status: 404 })

    const { data: acct, error } = await admin.from('connected_accounts').upsert(
      {
        creator_id: creator.id, platform: 'youtube', source: 'native',
        external_account_id: channelId, handle: title, status: 'connected',
        sync_frozen: false, consent_at: new Date().toISOString(),
      },
      { onConflict: 'creator_id,platform' },
    ).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('sync_jobs').insert({ account_id: acct.id, kind: 'account', status: 'queued' })
    return NextResponse.json({ ok: true, handle: title })
  } catch (e: any) {
    console.error('[CONNECT youtube]', e?.message)
    return NextResponse.json({ error: 'Could not connect that channel.' }, { status: 502 })
  }
}
