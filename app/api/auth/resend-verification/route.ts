import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

// Resends the Supabase confirmation email for the signed-in user.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.email_confirmed_at) {
    return NextResponse.json({ error: 'Email is already verified' }, { status: 400 })
  }

  if (!checkRateLimit(`resend-verification:${user.id}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
