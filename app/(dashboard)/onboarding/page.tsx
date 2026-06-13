import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/OnboardingForm'

export default async function OnboardingPage() {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: account } = await supabase.from('users')
    .select('role').eq('id', user.id).single()
  if (!account || (account.role !== 'brand' && account.role !== 'creator')) redirect('/dashboard')

  const role = account.role as 'brand' | 'creator'

  if (role === 'creator') {
    const { data: creator } = await supabase.from('creator_profiles')
      .select('niche, onboarding_completed_at').eq('user_id', user.id).single()
    if (creator?.onboarding_completed_at) redirect('/dashboard')

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Finish setting up</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pick your niche and connect a social account to start applying to campaigns.
          </p>
        </div>
        <OnboardingForm role="creator" initial={{ niche: creator?.niche }} />
      </div>
    )
  }

  const { data: brand } = await supabase.from('brand_profiles')
    .select('company_name, industry, website, social_url, onboarding_completed_at')
    .eq('user_id', user.id).single()
  if (brand?.onboarding_completed_at) redirect('/dashboard')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Finish setting up</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tell creators who you are before posting your first campaign.
        </p>
      </div>
      <OnboardingForm
        role="brand"
        initial={{
          company_name: brand?.company_name,
          industry: brand?.industry,
          website: brand?.website,
          social_url: brand?.social_url,
        }}
      />
    </div>
  )
}
