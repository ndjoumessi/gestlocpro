import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
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
      {/* Trois rôles, trois cartes. Réduites un temps à un filet, elles se
          confondaient : les droits de l'un se lisaient comme la suite du pitch
          de l'autre. Un rôle est une frontière — la carte la matérialise.
          Le nom redescend du corps d'affichage au titre : trois « Gestionnaire
          délégué » en 52px se disputaient l'attention avec le titre de section,
          et la comparaison — l'objet même de cette section — en pâtissait. */}
      <div className="grid gap-5 lg:grid-cols-3">
        {ROLES.map(({ key, icon, signup }) => (
          <article
            key={key}
            className={cn(
              'group flex flex-col rounded-xl border border-on-dark-border bg-ink-2 p-7 sm:p-8',
              'transition-[transform,border-color] duration-200 ease-out',
              'hover:-translate-y-1 hover:border-accent/45',
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Icon name={icon} size={22} />
            </span>

            <h3 className="mt-6 title-l text-on-dark">
              {t(`roles.${key}.name` as 'roles.owner.name')}
            </h3>
            <p className="mt-1.5 text-caps text-accent-on-dark">
              {t(`roles.${key}.short` as 'roles.owner.short')}
            </p>

            {/* Même raison que la réponse de FAQ : c'est le texte principal
                d'une carte de vitrine, celui qui décide, et le jeton de 16 px
                porte « landing » dans son propre commentaire. La glose de la
                grille de fonctionnalités, elle, reste en 14 : elle est
                SUBORDONNÉE à un titre, et l'échelle doit le dire. */}
            <p className="mt-5 flex-1 text-body-l text-pretty text-on-dark-muted">
              {t(`roles.${key}.pitch` as 'roles.owner.pitch')}
            </p>

            <p className="mt-6 border-t border-on-dark-border pt-5 text-body text-on-dark-muted">
              <span className="eyebrow mb-1 block text-on-dark-faint">
                {t('marketing.roles.seeMore')}
              </span>
              {t(`roles.${key}.rights` as 'roles.owner.rights')}
            </p>

            <Link
              to={signup}
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-body font-semibold text-accent-on-dark no-underline transition-colors duration-150 hover:text-accent"
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
