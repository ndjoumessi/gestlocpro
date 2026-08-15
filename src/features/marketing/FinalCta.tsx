import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

export function FinalCta() {
  const t = useT()

  return (
    <section className="on-dark relative overflow-hidden bg-ink px-5 py-20 text-on-dark sm:px-8 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 68%)' }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-lg bg-gold text-ink">
          <Icon name="sparkle" size={24} />
        </span>

        <h2 className="display-m mt-6 text-balance text-on-dark">{t('marketing.finalCta.title')}</h2>
        <p className="mt-4 text-body-l text-pretty text-on-dark-muted">
          {t('marketing.finalCta.subtitle')}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
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
