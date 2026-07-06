import { createAdminClient } from '@/lib/supabase/server'
import { sendProductEmail, link } from '@/lib/email'

/**
 * In-app notification + email, as one unit. Collabr is a website (no push):
 * a notification the user never logs in to see is a notification they never
 * got — so EVERY notification also sends an email by default.
 *
 * Call sites that already send a richer, event-specific product email pass
 * `email: false` to avoid double-sending. The fallback email mirrors the
 * notification copy in the standard branded layout and is deduped in
 * email_log under `email:notif:<dedupeKey>`.
 */
export async function sendNotification({
  userId, type, title, body, payload = {}, dedupeKey, email = true
}: {
  userId: string
  type: string
  title: string
  body?: string
  payload?: Record<string, unknown>
  dedupeKey?: string
  /** false = the caller sends its own specific product email for this event. */
  email?: boolean
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    payload,
    dedupe_key: dedupeKey || null,
  })

  if (error && error.code !== '23505') {
    console.error('[NOTIFICATION]', error)
  }

  // A deduped notification (23505) was already delivered — don't email again.
  if (!email || error?.code === '23505') return

  const collabId = typeof payload.collab_id === 'string' ? payload.collab_id : null
  await sendProductEmail({
    userId,
    type: `notif_${type}`,
    // Mirror the notification's dedupe behaviour: same key → one email ever.
    // MUST include userId: notification dedupe is per (user, key) but
    // email_log's key is GLOBALLY unique — without the userId, a fan-out that
    // shares one key across many recipients would email only the first.
    dedupeKey: `email:notif:${userId}:${dedupeKey || `${type}:${Date.now()}`}`,
    subject: title,
    title,
    body: body || title,
    ctaLabel: collabId ? 'Open collaboration' : 'View on Collabr',
    ctaUrl: link(collabId ? `/collabs/${collabId}` : '/notifications'),
  })
}
