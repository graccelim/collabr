import type { createAdminClient } from '@/lib/supabase/server'
import { isProActive } from '@/lib/entitlements'
import { flags } from '@/lib/flags'

// Server-side: is this creator currently an active Creator Pro subscriber?
// Reads the PRIVATE creator_subscriptions row via the admin client and applies
// the pure entitlement rules. Used at collab creation to set the commission rate
// (Creator Pro = 10%, Free = 12%) — independent of the brand's plan.
export async function isCreatorProActive(
  admin: ReturnType<typeof createAdminClient>,
  creatorId: string | null | undefined,
): Promise<boolean> {
  // Suite off → Creator Pro doesn't exist → no Pro commission benefit (and no DB call).
  if (!flags.analyticsSuite) return false
  if (!creatorId) return false
  const { data } = await admin
    .from('creator_subscriptions')
    .select('status, pro_until')
    .eq('creator_id', creatorId)
    .maybeSingle()
  return isProActive(data ?? null)
}
