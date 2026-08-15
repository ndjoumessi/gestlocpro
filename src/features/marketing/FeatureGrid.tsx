import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'rent', icon: 'card' },
  { key: 'utilities', icon: 'droplet' },
  { key: 'reminders', icon: 'bell' },
  { key: 'inspections', icon: 'clipboard' },
  { key: 'works', icon: 'wrench' },
  { key: 'deposits', icon: 'shield' },
]

export function FeatureGrid() {
  const t = useT()

  return (
    <Section
      id="features"
      eyebrow={t('marketing.features.eyebrow')}
      title={t('marketing.features.title')}
      description={t('marketing.features.subtitle')}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon }) => (
          <article
            key={key}
            className="group rounded-lg border border-divider bg-surface p-6 shadow-e1 transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-e2"
          >
            <span className="flex size-11 items-center justify-center rounded-md bg-gold-tint text-gold-ink transition-colors duration-200 group-hover:bg-ink group-hover:text-gold">
              <Icon name={icon} size={20} />
            </span>

            <h3 className="mt-5 font-sans text-title-m font-semibold">
              {t(`marketing.features.${key}.title` as 'marketing.features.rent.title')}
            </h3>
            <p className="mt-2 text-body text-pretty text-muted">
              {t(`marketing.features.${key}.body` as 'marketing.features.rent.body')}
            </p>
          </article>
        ))}
      </div>
    </Section>
  )
}
