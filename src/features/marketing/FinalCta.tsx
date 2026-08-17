import { cn } from '@/lib/cn'
import { Button } from '@/components/primitives/Button'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { useT } from '@/i18n/I18nProvider'

export function FinalCta() {
  const t = useT()

  return (
    // Halo flou et pastille d'icône retirés : ni l'un ni l'autre ne portait
    // d'information, et le halo affaiblissait le contraste du fond sombre, qui
    // est ici le seul effet recherché. Le titre monte d'un cran : c'est la
    // dernière déclaration de la page, elle doit peser autant que la première.
    //
    // `py-24/28/32` et non `py-28/36/48`. La section ne porte qu'un titre, une
    // phrase et deux boutons : à 192 px de rembourrage de chaque côté, le bloc
    // sombre se lisait comme une bande vide bien plus que comme une conclusion,
    // et l'appel à l'action se retrouvait isolé au milieu de rien. Une
    // respiration généreuse reste voulue — c'est la dernière chose qu'on lit —
    // mais elle doit encadrer le propos, pas le noyer.
    <section
      className={cn('on-dark bg-ink py-24 text-on-dark sm:py-28 lg:py-32', GOUTTIERE_LATERALE)}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="display-l text-balance text-on-dark">{t('marketing.finalCta.title')}</h2>
        <p className="mt-6 text-body-l text-pretty text-on-dark-muted">
          {t('marketing.finalCta.subtitle')}
        </p>

        <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="gold" to="/inscription" iconAfter="arrowRight">
            {t('marketing.finalCta.cta')}
          </Button>
          <Button size="lg" variant="onDark" to="/demo">
            {t('marketing.finalCta.secondary')}
          </Button>
        </div>
      </div>
    </section>
  )
}
