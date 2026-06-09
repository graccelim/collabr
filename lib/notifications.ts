import { createAdminClient } from '@/lib/supabase/server'

export async function sendNotification({
  userId, type, title, body, payload = {}
}: {
  userId: string
  type: string
  title: string
  body?: string
  payload?: Record<string, unknown>
}) {
  const supabase = createAdminClient()
  await supabase.from('notifications').insert({ user_id: userId, type, title, body, payload })
}
