import { createAdminClient } from '@/lib/supabase/server'

export async function sendNotification({
  userId, type, title, body, payload = {}, dedupeKey
}: {
  userId: string
  type: string
  title: string
  body?: string
  payload?: Record<string, unknown>
  dedupeKey?: string
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
}
