import type { createAdminClient } from '@/lib/supabase/server'

// Brand Stripe IDs live in the PRIVATE brand_subscriptions table (not on the
// public-read brand_profiles). The brand Stripe *customer* is shared by escrow
// and subscriptions; both read/write it through these helpers (service role).
type Admin = ReturnType<typeof createAdminClient>

export async function getBrandStripeCustomerId(admin: Admin, brandId: string): Promise<string | null> {
  const { data } = await admin
    .from('brand_subscriptions')
    .select('stripe_customer_id')
    .eq('brand_id', brandId)
    .maybeSingle()
  return data?.stripe_customer_id ?? null
}

export async function setBrandStripeCustomer(
  admin: Admin,
  brandId: string,
  customerId: string,
  subscriptionId?: string | null,
): Promise<void> {
  await admin.from('brand_subscriptions').upsert(
    {
      brand_id: brandId,
      stripe_customer_id: customerId,
      ...(subscriptionId !== undefined ? { stripe_subscription_id: subscriptionId } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id' },
  )
}

export async function getBrandIdByStripeCustomer(admin: Admin, customerId: string): Promise<string | null> {
  const { data } = await admin
    .from('brand_subscriptions')
    .select('brand_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.brand_id ?? null
}
