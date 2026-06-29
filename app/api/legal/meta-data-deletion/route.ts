import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { parseSignedRequest, purgeMetaUser } from '@/lib/analytics/metaDeletion'

// Meta "Data Deletion Request Callback". When a user asks Meta to delete their
// data, Meta POSTs a `signed_request` here. We verify it with META_APP_SECRET,
// delete every Instagram account tied to that Meta user id, and return the
// { url, confirmation_code } JSON Meta requires so the user can track status.
// Configure this URL in the Meta app dashboard:
//   https://<your-domain>/api/legal/meta-data-deletion
export const runtime = 'nodejs'

// Meta (and humans) may GET this URL to check it exists. The real work is POST.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'meta-data-deletion',
    info: 'This endpoint accepts POST requests with a signed_request from Meta. To delete your data, see /data-deletion.',
  })
}

export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const form = await req.formData().catch(() => null)
  const signed = form?.get('signed_request')
  if (typeof signed !== 'string') return NextResponse.json({ error: 'missing_signed_request' }, { status: 400 })

  const data = parseSignedRequest(signed, secret)
  if (!data?.user_id) return NextResponse.json({ error: 'invalid_signed_request' }, { status: 400 })

  // Deterministic, non-guessable confirmation code tied to this Meta user id.
  const confirmationCode = crypto.createHash('sha256').update(`${data.user_id}:${secret}`).digest('hex').slice(0, 16)

  // Delete every Instagram account (and derived data) for this Meta user. Best
  // effort: never fail the callback (Meta retries on non-2xx).
  try {
    const purged = await purgeMetaUser(createAdminClient(), data.user_id)
    console.log(`[meta-data-deletion] user_id=${data.user_id} purged=${purged} code=${confirmationCode}`)
  } catch (e: any) {
    console.error('[meta-data-deletion] purge failed:', e?.message)
  }

  return NextResponse.json({
    url: `${appUrl}/data-deletion?source=meta&code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
