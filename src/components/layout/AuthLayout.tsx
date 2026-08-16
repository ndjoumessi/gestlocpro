import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/primitives/Logo'
import { Icon } from '@/components/primitives/Icon'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useT } from '@/i18n/I18nProvider'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export interface AuthLayoutProps {
  title: string
  /**
   * Titre de l'onglet, quand celui de la page ne suffit pas à situer.
   * L'assistant d'inscription s'en sert : son `title` est celui de l'étape
   * courante — « Vos informations » seul ne dit pas qu'on crée un compte.
   */
  documentTitle?: string
  subtitle?: string
  children: ReactNode
  /** Pied de carte : lien vers l'autre parcours. */
  footer?: ReactNode
  /** Élargit la colonne pour l'assistant d'inscription. */
  wide?: boolean
  /** Contenu au-dessus du titre : fil d'étapes, retour. */
  above?: ReactNode
}

/**
 * Gabarit des pages d'authentification : deux colonnes sur grand écran,
 * une seule sur mobile où le panneau de marque passe en simple bandeau.
 */
export function AuthLayout({
  title,
  documentTitle,
  subtitle,
  children,
  footer,
  wide,
  above,
}: AuthLayoutProps) {
  const t = useT()
  useDocumentTitle(documentTitle ?? title)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex items-center gap-3 px-5 py-4 sm:px-8">
          {/* Ce lien portait `lg:hidden` : sur ordinateur, il n'existait pas.
              Et le logo du panneau de marque n'était pas cliquable. Les pages
              d'authentification étaient donc un cul-de-sac — on y entrait
              depuis la landing sans pouvoir y revenir autrement que par le
              bouton du navigateur.

              Il est maintenant visible partout. Le logo renvoie lui aussi à
              l'accueil, par convention, mais il vit dans le panneau sombre à
              l'autre bout de l'écran : l'issue doit être dans la colonne où se
              trouve le formulaire, pas à côté.

              `backToHome` et non `back` : dans l'inscription, « Retour » ramène
              à l'étape précédente. Deux destinations, deux libellés. */}
          <Link
            to="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-muted no-underline transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
          >
            <Icon name="chevronLeft" size={16} />
            {t('common.backToHome')}
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-5 pt-4 pb-16 sm:px-8">
          <div className={cn('w-full', wide ? 'max-w-3xl' : 'max-w-md')}>
            {above}

            {/* `display-app` et non `display-m` : un formulaire est une tâche,
                pas une déclaration. À 52px, « Content de vous revoir »
                disputait l'attention aux champs qu'il surplombe. Le panneau de
                marque à gauche garde le grand corps — c'est lui qui parle. */}
            <h1 className="display-app text-balance">{title}</h1>
            {subtitle && <p className="mt-3 text-body-l text-pretty text-muted">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-8 border-t border-border pt-6 text-body text-muted">{footer}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/** Colonne de marque : bandeau sur mobile, panneau plein sur grand écran. */
function BrandPanel() {
  const t = useT()

  const points = [
    'marketing.features.rent.title',
    'marketing.features.utilities.title',
    'marketing.features.reminders.title',
    'marketing.features.inspections.title',
  ] as const

  return (
    <div className="on-dark relative flex shrink-0 flex-col overflow-hidden bg-ink px-5 py-6 text-on-dark sm:px-8 lg:w-[42%] lg:max-w-xl lg:justify-between lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-[30rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)' }}
      />

      <div className="relative">
        {/* Le logo ramène à l'accueil : c'est la convention, et elle vaut à
            toutes les tailles — sur mobile, ce bandeau est la seule partie du
            panneau de marque qui reste visible. */}
        <Logo tone="dark" size="md" to="/" />
      </div>

      {/* Argumentaire réservé au grand écran : sur mobile il repousserait le
          formulaire sous la ligne de flottaison. */}
      <div className="relative mt-auto hidden lg:block">
        <p className="display-m max-w-sm text-balance text-on-dark">{t('brand.tagline')}.</p>

        <ul className="mt-8 flex flex-col gap-3">
          {points.map((key) => (
            <li key={key} className="flex items-center gap-3 text-body text-on-dark-muted">
              <Icon name="check" size={16} strokeWidth={2.2} className="shrink-0 text-gold" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
