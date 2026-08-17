import { cn } from '@/lib/cn'
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
      {/* Les cartes reviennent, mais construites.
          Une passe précédente les avait réduites à un filet, au nom de
          « elements minimal ». Six blocs de texte flottants ne se comparent
          pas : sans surface, l'œil ne sait plus où commence et où finit une
          fonctionnalité, et la page se lit comme un document. La surface est
          ici une aide à la lecture, pas un ornement.
          Ce qui a changé par rapport à la version d'origine : le rembourrage
          passe de 24 à 32px, l'élévation est plus discrète au repos, et le
          survol soulève la carte au lieu de seulement changer sa bordure. */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon }) => (
          <article
            key={key}
            className={cn(
              'group rounded-xl border border-divider bg-surface p-7 sm:p-8',
              'shadow-e1 transition-[transform,box-shadow,border-color] duration-200 ease-out',
              'hover:-translate-y-1 hover:border-border-strong hover:shadow-e2',
            )}
          >
            <span
              className={cn(
                'flex size-12 items-center justify-center rounded-lg',
                'bg-gold-tint text-gold-ink transition-colors duration-200',
                // `gold-on-ink` : au survol le fond devient `--color-ink`, qui
                // s'inverse avec le thème. L'or de marque, lui, ne bouge pas —
                // la paire tenait 7,04:1 au repos et tombait à 2,33:1 au survol
                // en sombre. Le survol dégradait donc activement la lisibilité.
                'group-hover:bg-ink group-hover:text-gold-on-ink',
              )}
            >
              <Icon name={icon} size={22} />
            </span>

            <h3 className="mt-6 title-l text-balance">
              {t(`marketing.features.${key}.title` as 'marketing.features.rent.title')}
            </h3>
            <p className="mt-3 text-body text-pretty text-muted">
              {t(`marketing.features.${key}.body` as 'marketing.features.rent.body')}
            </p>
          </article>
        ))}
      </div>
    </Section>
  )
}
