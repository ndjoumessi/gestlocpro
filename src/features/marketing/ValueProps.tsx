import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const KEYS = ['one', 'two', 'three', 'four'] as const

/**
 * Avant / après. Deux colonnes en vis-à-vis, ligne à ligne : chaque friction
 * de gauche trouve sa réponse à la même hauteur à droite.
 */
export function ValueProps() {
  const t = useT()

  return (
    <Section id="value" tone="paper" eyebrow={t('marketing.value.eyebrow')} title={t('marketing.value.title')} description={t('marketing.value.body')}>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="rounded-lg border border-border bg-surface-sunken p-6">
          <h3 className="eyebrow font-sans text-muted">Aujourd’hui</h3>
          <ul className="mt-5 flex flex-col gap-4">
            {KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <Icon name="close" size={16} className="mt-1 shrink-0 text-danger" />
                <span className="text-body text-muted">
                  {t(`marketing.value.before.${key}` as 'marketing.value.before.one')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gold-border bg-gold-tint p-6">
          <h3 className="eyebrow font-sans text-gold-ink">{t('marketing.value.afterTitle')}</h3>
          <ul className="mt-5 flex flex-col gap-4">
            {KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <Icon name="check" size={16} strokeWidth={2.2} className="mt-1 shrink-0 text-ok" />
                <span className="text-body font-medium text-ink">
                  {t(`marketing.value.after.${key}` as 'marketing.value.after.one')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}
