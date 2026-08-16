import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Hero } from '@/features/marketing/Hero'
import { ValueProps } from '@/features/marketing/ValueProps'
import { FeatureGrid } from '@/features/marketing/FeatureGrid'
import { RolesSection } from '@/features/marketing/RolesSection'
import { InternationalSection } from '@/features/marketing/InternationalSection'
import { PricingSection } from '@/features/marketing/PricingSection'
import { Faq } from '@/features/marketing/Faq'
import { FinalCta } from '@/features/marketing/FinalCta'

export function Landing() {
  return (
    <>
      <PublicHeader />
      <main id="main">
        <Hero />
        <ValueProps />
        <FeatureGrid />
        <RolesSection />
        <InternationalSection />        <PricingSection />
        <Faq />
        <FinalCta />
      </main>
      <PublicFooter />
    </>
  )
}
