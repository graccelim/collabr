import LandingTabs from '@/components/landing/LandingTabs'
import BrandLandingContent from '@/components/landing/BrandLandingContent'
import CreatorLandingContent from '@/components/landing/CreatorLandingContent'

export default function ConciergeLanding() {
  return (
    <LandingTabs
      brandContent={<BrandLandingContent />}
      creatorContent={<CreatorLandingContent />}
    />
  )
}
