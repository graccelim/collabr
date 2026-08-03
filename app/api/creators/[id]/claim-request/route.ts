import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimitDurable, clientIp } from '@/lib/rate-limit'
import { sendOpsAdminEmail } from '@/lib/email'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joincollabr.com').replace(/\/+$/, '')

// Self-service "is this you?" / "not you" signal from a public, unclaimed
// creator profile. Deliberately does NOT issue or expose a claim token - it
// only notifies the ops inbox (the exact reused mechanism createInvite's
// pending-collab-request path already uses), so an admin can verify and send
// the real one-time claim link over DM, same as always. Nothing new is
// persisted; the email itself is the ticket, same as disputes/payouts.
const bodySchema = z.object({ kind: z.enum(['claim', 'remove']) })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkRateLimitDurable(`claim-request:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('id, slug, display_name, user_id')
    .eq('id', params.id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (creator.user_id) return NextResponse.json({ error: 'This profile is already claimed.' }, { status: 409 })

  const name = creator.display_name || 'Unnamed creator'
  const profileUrl = `${APP_URL}/creators/${creator.slug || creator.id}`

  if (parsed.data.kind === 'claim') {
    await sendOpsAdminEmail(
      `Creator self-identified: ${name}`,
      { Creator: name, Profile: profileUrl, Next: 'Verify on Instagram/TikTok, then DM their secure claim link.' },
      `claim-request:${creator.id}`,
    ).catch(e => console.error('[CLAIM REQUEST] ops email failed:', e))
  } else {
    await sendOpsAdminEmail(
      `Removal requested: ${name}`,
      { Creator: name, Profile: profileUrl, Next: 'Archive this profile.' },
      `remove-request:${creator.id}`,
    ).catch(e => console.error('[CLAIM REQUEST] ops email failed:', e))
  }

  return NextResponse.json({ success: true })
}
