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
      .select('niche, niche_tags, onboarding_completed_at').eq('user_id', user.id).single()
    if (creator?.onboarding_completed_at) redirect('/dashboard')

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Add a social profile to go live</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            One social profile takes you live — it&rsquo;s what brands open before selecting anyone.
            Niches are optional here and improve your campaign matches.
          </p>
        </div>
        <OnboardingForm role="creator" initial={{ niche: creator?.niche, niche_tags: creator?.niche_tags }} />
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
        <h1 className="text-xl font-semibold text-gray-900">Tell creators about your company</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your industry plus a website or social — creators check this before they apply. Then you can post your first campaign.
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
