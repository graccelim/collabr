import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { aiConfigured } from '@/lib/ai/client'
import { isCreatorProActive } from '@/lib/creator-pro'
import { contentLab } from '@/lib/ai/service'
import { checkRateLimit } from '@/lib/rate-limit'

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'lemon8', 'xhs', 'x']

// Content Lab generator. Pro-gated, flag-gated, fail-safe.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!flags.analyticsAi) return NextResponse.json({ error: 'Not available' }, { status: 503 })
  if (!aiConfigured()) return NextResponse.json({ error: 'AI is not configured yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.json({ error: 'Creator Pro required.' }, { status: 403 })
  }
  if (!checkRateLimit(`ai-lab:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 300) : ''
  const platform = typeof body?.platform === 'string' ? body.platform : ''
  if (!topic || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'A topic and a supported platform are required.' }, { status: 400 })
  }
  const tone = typeof body?.tone === 'string' ? body.tone.slice(0, 60) : undefined
  const goal = typeof body?.goal === 'string' ? body.goal.slice(0, 80) : undefined

  // Tailor to the creator's OWN winning patterns for this platform (best length/
  // window/category/style). Falls back to a generic generator when absent.
  const { data: pi } = await supabase.from('creator_platform_insights')
    .select('data').eq('creator_id', creator.id).eq('platform', platform).maybeSingle()
  const piData = pi?.data as any
  const insights = piData?.insights?.length
    ? { overview: piData.overview, insights: piData.insights }
    : undefined

  try {
    const result = await contentLab({ topic, platform, tone, goal, insights })
    await admin.from('ai_chat_messages').insert([
      { creator_id: creator.id, role: 'user', surface: 'content_lab', content: `${topic} (${platform})` },
      { creator_id: creator.id, role: 'assistant', surface: 'content_lab', content: JSON.stringify(result) },
    ])
    return NextResponse.json({ result })
  } catch (e: any) {
    console.error('[AI content-lab]', e?.message)
    return NextResponse.json({ error: 'Could not generate ideas.' }, { status: 502 })
  }
}
