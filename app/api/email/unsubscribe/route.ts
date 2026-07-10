import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyUnsubscribeToken, link } from '@/lib/email'

// Campaign-alert opt-out. Linked from every alert email ("Turn off campaign
// alerts") and wired as the List-Unsubscribe target. The HMAC token proves the
// link came from an email we sent, so no login is needed. GET serves a human
// confirmation page; POST is RFC 8058 one-click for mail clients. Re-enabling
// lives in Settings.
async function unsubscribe(req: NextRequest): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''
  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) return false
  const { error } = await createAdminClient().from('creator_profiles')
    .update({ campaign_alerts: false }).eq('user_id', uid)
  if (error) {
    console.error('[UNSUBSCRIBE]', error.message)
    return false
  }
  return true
}

function page(title: string, body: string): NextResponse {
  return new NextResponse(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:440px;margin:80px auto;padding:40px;background:#fff;border:1px solid #E6E8EE;border-radius:16px;text-align:center;">
<div style="font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#0E1016;margin-bottom:18px;">collabr<span style="color:#000435;">.</span></div>
<h1 style="margin:0 0 10px;font-size:20px;color:#0E1016;">${title}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#545A66;">${body}</p>
<a href="${link('/settings')}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;border-radius:10px;background:#000435;">Manage in Settings</a>
</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const ok = await unsubscribe(req)
  return ok
    ? page('Campaign alerts turned off', 'You will no longer get an email when a new campaign matches your niche. You can turn alerts back on anytime from Settings.')
    : page('That link didn’t work', 'The unsubscribe link is invalid or expired. You can manage campaign alerts from your Settings page instead.')
}

// RFC 8058 one-click unsubscribe (mail clients POST with no body we need).
export async function POST(req: NextRequest) {
  const ok = await unsubscribe(req)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
