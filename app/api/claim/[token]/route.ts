import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateClaimToken, consumeClaimToken, markClaimOpened } from '@/lib/creator-claims'
import { checkRateLimitDurable, clientIp } from '@/lib/rate-limit'
import { ensureCreatorSlug } from '@/lib/slug-server'
import { createInvite } from '@/lib/invites'
import { emails } from '@/lib/email'

// GET is read-only by design: Instagram/TikTok DM link previews can trigger
// an automated bot fetch of a pasted URL before the human ever opens it. If
// the token were consumed here, that crawler could burn a one-time link
// before the real creator sees it. Validation and display only - consumption
// happens exclusively in POST, on the creator's own explicit submit.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  if (!(await checkRateLimitDurable(`claim-view:${clientIp(req)}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { status, claim } = await validateClaimToken(admin, params.token)
  if (status !== 'valid' || !claim) {
    return NextResponse.json({ status }, { status: 200 })
  }

  const { data: creator } = await admin.from('creator_profiles')
    .select('display_name, bio, niche_tags, social_accounts(platform, handle, follower_count)')
    .eq('id', claim.creator_id).single()
  if (!creator) return NextResponse.json({ status: 'not_found' })

  // Funnel signal only - a valid GET is the closest thing to "a human looked
  // at the offer" we can record without touching the read-only contract above.
  await markClaimOpened(admin, claim.id)

  return NextResponse.json({
    status: 'valid',
    creator: {
      displayName: creator.display_name,
      bio: creator.bio,
      nicheTags: creator.niche_tags,
      socials: creator.social_accounts,
    },
  })
}

const claimSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
})

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!(await checkRateLimitDurable(`claim-submit:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = claimSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }
  const { email, password } = parsed.data

  const admin = createAdminClient()

  // Re-validate (not just trust an earlier GET) - the token could have expired,
  // been used, or been revoked between page load and submit.
  const { status } = await validateClaimToken(admin, params.token)
  if (status !== 'valid') {
    return NextResponse.json({ error: 'This claim link is no longer valid.', status }, { status: 410 })
  }

  // Same auth creation path as normal signup - the claim token proves "you're
  // the right creator" (via the DM channel it was sent through); it does NOT
  // prove you control the email you're about to type in. Supabase's own email
  // confirmation still applies here exactly like any other signup, so a
  // claimed account never has a weaker trust bar than a self-serve one.
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joincollabr.com').replace(/\/+$/, '')
  const supabase = createClient()
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${APP_URL}/dashboard` },
  })
  if (authErr) {
    if (/sending.*email|confirmation email/i.test(authErr.message)) {
      return NextResponse.json({ error: "We couldn't send your verification email right now. Please try again in a few minutes." }, { status: 503 })
    }
    return NextResponse.json({ error: authErr.message }, { status: 400 })
  }
  if (!authData.user) return NextResponse.json({ error: 'Could not create your account' }, { status: 500 })
  if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
    return NextResponse.json({ error: 'This email is already registered. Sign in instead.' }, { status: 409 })
  }
  const requiresEmailVerification = !authData.session

  // Consume the token NOW, atomically - this is the actual race-guard against
  // two concurrent claim attempts on the same link (e.g. a double-submit).
  const claim = await consumeClaimToken(admin, params.token)
  if (!claim) {
    // Someone else claimed it in the gap between validate and here. The auth
    // user we just created is orphaned but harmless (unlinked, no creator
    // profile) - they can just sign in normally as a bare account, or contact
    // support. Rare enough (two people submitting the same link within
    // milliseconds) not to warrant deleting the just-created auth user here.
    return NextResponse.json({ error: 'This claim link was just used. If you believe this is a mistake, contact support.' }, { status: 409 })
  }

  const { data: creator } = await admin.from('creator_profiles')
    .select('id, display_name').eq('id', claim.creator_id).single()
  // Seeds users.display_name's initial value - same one-time-seed pattern as
  // normal signup taking `name` from the signup form. Not an ongoing sync.
  const displayName = creator?.display_name || 'there'

  const { error: userErr } = await admin.from('users').insert({
    id: authData.user.id,
    role: 'creator',
    email,
    display_name: displayName,
  })
  if (userErr) {
    console.error('[CLAIM] users insert failed:', userErr)
    return NextResponse.json({ error: 'Could not finish setting up your account' }, { status: 500 })
  }

  // The actual link + trust boundary: only rows where user_id IS NULL can be
  // claimed, same guard ensureSlug uses for slug-claiming races. Deliberately
  // does NOT touch is_verified - "claimed" is user_id IS NOT NULL, full stop;
  // is_verified stays untouched and free for an actual future identity-
  // verification feature, not repurposed as a duplicate claimed-flag.
  const { error: linkErr } = await admin.from('creator_profiles')
    .update({ user_id: authData.user.id })
    .eq('id', claim.creator_id).is('user_id', null)
  if (linkErr) {
    console.error('[CLAIM] profile link failed:', linkErr)
    return NextResponse.json({ error: 'Could not finish setting up your account' }, { status: 500 })
  }

  await ensureCreatorSlug(admin, claim.creator_id, displayName)

  // Materialize every pending "Request Collaboration" for this creator into a
  // REAL campaign_invites row now that there's a real account to notify - via
  // the exact same createInvite() the normal brand-invite flow uses, so
  // campaign_invites never holds anything but genuine, dispatched invitations.
  const { data: pendingRequests } = await admin.from('pending_collab_requests')
    .select('id, brand_id, campaign_id, proposed_rate, message, brand_profiles(company_name)')
    .eq('creator_id', claim.creator_id)
    .is('materialized_at', null)
  for (const reqRow of pendingRequests || []) {
    try {
      const result = await createInvite(admin, {
        campaignId: reqRow.campaign_id,
        brandId: reqRow.brand_id,
        brandName: (reqRow.brand_profiles as any)?.company_name || 'A brand',
        creatorId: claim.creator_id,
        proposedRate: reqRow.proposed_rate,
        message: reqRow.message,
      })
      if (!result.ok) {
        console.error('[CLAIM] request materialization rejected:', result.error)
        continue
      }
      await admin.from('pending_collab_requests').update({ materialized_at: new Date().toISOString() }).eq('id', reqRow.id)
    } catch (e) {
      console.error('[CLAIM] request materialization failed:', e)
    }
  }

  if (!requiresEmailVerification) emails.welcomeCreator(displayName, email).catch(e => console.error('[CLAIM WELCOME EMAIL]', e))

  return NextResponse.json({ success: true, requiresEmailVerification })
}
