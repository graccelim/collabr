import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseSignedRequest, purgeMetaUser } from '@/lib/analytics/metaDeletion'

// Meta "Deauthorize Callback". When a user removes Collabr from their Facebook /
// Instagram settings, Meta POSTs a `signed_request` here. We verify it with
// META_APP_SECRET and delete the Instagram account(s) tied to that Meta user id,
// so a deauthorization truly removes their data.
// Configure this URL in the Meta app dashboard (Facebook Login settings):
//   https://<your-domain>/api/legal/meta-deauthorize
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'meta-deauthorize',
    info: 'This endpoint accepts POST requests with a signed_request from Meta when a user deauthorizes the app.',
  })
}

export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const form = await req.formData().catch(() => null)
  const signed = form?.get('signed_request')
  if (typeof signed !== 'string') return NextResponse.json({ error: 'missing_signed_request' }, { status: 400 })

  const data = parseSignedRequest(signed, secret)
  if (!data?.user_id) return NextResponse.json({ error: 'invalid_signed_request' }, { status: 400 })

  // Best effort: never fail the callback (Meta retries on non-2xx).
  try {
    const purged = await purgeMetaUser(createAdminClient(), data.user_id)
    console.log(`[meta-deauthorize] user_id=${data.user_id} purged=${purged}`)
  } catch (e: any) {
    console.error('[meta-deauthorize] purge failed:', e?.message)
  }

  return NextResponse.json({ ok: true })
}
