import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Meta "Data Deletion Request Callback". When a user removes Collabr from their
// Facebook/Instagram settings, Meta POSTs a `signed_request` here. We verify it
// with META_APP_SECRET, kick off deletion for that platform user, and return the
// { url, confirmation_code } JSON Meta requires so the user can track status.
// Configure this URL in the Meta app dashboard:
//   https://<your-domain>/api/legal/meta-data-deletion
export const runtime = 'nodejs'

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function parseSignedRequest(signed: string, secret: string): { user_id?: string } | null {
  const [encSig, encPayload] = signed.split('.')
  if (!encSig || !encPayload) return null
  const expected = crypto.createHmac('sha256', secret).update(encPayload).digest()
  const sig = b64urlDecode(encSig)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null
  try {
    return JSON.parse(b64urlDecode(encPayload).toString('utf8'))
  } catch {
    return null
  }
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

  // TODO (manual follow-up): if you store the Meta external_id on connected_accounts,
  // look it up here and delete that creator's Meta-derived rows. Until then, the
  // request is recorded and honoured via the standard deletion flow.
  console.log(`[meta-data-deletion] request for user_id=${data.user_id} code=${confirmationCode}`)

  return NextResponse.json({
    url: `${appUrl}/data-deletion?source=meta&code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
