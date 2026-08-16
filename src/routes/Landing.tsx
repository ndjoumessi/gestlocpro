import { useT } from '@/i18n/I18nProvider'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
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
  const t = useT()
  // Le titre statique d'`index.html` est en français : il subsistait tel quel
  // sur une page basculée en anglais. `withBrand: false` — il porte déjà le nom
  // du produit en tête.
  useDocumentTitle(`${t('brand.name')} — ${t('brand.tagline')}`, { withBrand: false })

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
