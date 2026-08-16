import { Button } from '@/components/primitives/Button'
import { useT } from '@/i18n/I18nProvider'

export function FinalCta() {
  const t = useT()

  return (
    // Halo flou et pastille d'icône retirés : ni l'un ni l'autre ne portait
    // d'information, et le halo affaiblissait le contraste du fond sombre, qui
    // est ici le seul effet recherché. Le titre monte d'un cran : c'est la
    // dernière déclaration de la page, elle doit peser autant que la première.
    <section className="on-dark bg-ink px-5 py-28 text-on-dark sm:px-8 sm:py-36 lg:py-48">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="display-l text-balance text-on-dark">{t('marketing.finalCta.title')}</h2>
        <p className="mt-6 text-body-l text-pretty text-on-dark-muted">
          {t('marketing.finalCta.subtitle')}
        </p>

        <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="gold" to="/inscription" iconAfter="arrowRight">
            {t('marketing.finalCta.cta')}
          </Button>
          <Button size="lg" variant="onDark" to="/app">
            {t('marketing.finalCta.secondary')}
          </Button>
        </div>
      </div>
    </section>
  )
}
