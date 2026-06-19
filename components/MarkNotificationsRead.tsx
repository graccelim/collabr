'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Marks the viewer's notifications read when the Notifications page opens, then
 * refreshes so the server-rendered unread badge (nav / top bar) clears right
 * away instead of waiting for a manual reload.
 */
export default function MarkNotificationsRead({ userId }: { userId: string }) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .then(() => { router.refresh() })
  }, [userId, router])

  return null
}
