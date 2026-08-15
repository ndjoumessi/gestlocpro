import { Link } from 'react-router-dom'
import { Section } from '@/components/layout/Section'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const ROLES: { key: 'owner' | 'manager' | 'tenant'; icon: IconName; signup: string }[] = [
  { key: 'owner', icon: 'building', signup: '/inscription/proprietaire' },
  { key: 'manager', icon: 'users', signup: '/inscription/gestionnaire' },
  { key: 'tenant', icon: 'key', signup: '/inscription/locataire' },
]

export function RolesSection() {
  const t = useT()

  return (
    <Section
      id="roles"
      tone="dark"
      eyebrow={t('marketing.roles.eyebrow')}
      title={t('marketing.roles.title')}
      description={t('marketing.roles.subtitle')}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {ROLES.map(({ key, icon, signup }) => (
          <article
            key={key}
            className="flex flex-col rounded-lg border border-on-dark-border bg-ink-2 p-6 transition-colors duration-200 hover:border-gold/50"
          >
            <span className="flex size-11 items-center justify-center rounded-md bg-gold text-ink">
              <Icon name={icon} size={20} />
            </span>

            <h3 className="mt-5 font-sans text-title-l font-semibold text-on-dark">
              {t(`roles.${key}.name` as 'roles.owner.name')}
            </h3>
            <p className="mt-1 font-mono text-mono-label text-gold-on-dark">
              {t(`roles.${key}.short` as 'roles.owner.short')}
            </p>

            <p className="mt-4 flex-1 text-body text-pretty text-on-dark-muted">
              {t(`roles.${key}.pitch` as 'roles.owner.pitch')}
            </p>

            <p className="mt-5 border-t border-on-dark-border pt-4 text-body-s text-on-dark-muted">
              <span className="eyebrow mr-2 text-on-dark-faint">
                {t('marketing.roles.seeMore')}
              </span>
              <br />
              {t(`roles.${key}.rights` as 'roles.owner.rights')}
            </p>

            <Link
              to={signup}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-body font-semibold text-gold-on-dark no-underline transition-colors duration-150 hover:text-gold"
            >
              {t('auth.signUp')}
              <Icon name="arrowRight" size={16} />
            </Link>
          </article>
        ))}
      </div>
    </Section>
  )
}
