'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Marks the creator's Invites tab as seen when it opens, then refreshes so the
 * nav's "new invite" badge clears right away (the invites themselves stay
 * listed until accepted/declined).
 */
export default function MarkInvitesSeen({ userId }: { userId: string }) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.from('creator_profiles')
      .update({ invites_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .then(() => { router.refresh() })
  }, [userId, router])
  return null
}
