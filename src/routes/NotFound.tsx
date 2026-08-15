import { Link, useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Logo } from '@/components/primitives/Logo'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useT } from '@/i18n/I18nProvider'

/**
 * Adresse inconnue.
 *
 * La route attrape-tout rendait la landing page : une URL fautive s'affichait
 * comme si elle était la destination — pas d'erreur, pas d'indice, et un lien
 * mort partagé par un prospect passait pour un site normal.
 *
 * Deux écrans plutôt qu'un, parce que le contexte de l'égarement diffère. Hors
 * de l'application, on ne sait rien de l'intention : on renvoie vers l'accueil.
 * Dans l'espace de gestion, la barre latérale liste déjà les écrans existants —
 * la garder sous les yeux vaut mieux que d'éjecter l'utilisateur vers la
 * landing, ce qui lui ferait perdre le fil de sa session.
 */

/** Longueur au-delà de laquelle l'adresse fautive est coupée. */
const MAX_PATH = 120

/**
 * Rappelle l'adresse demandée.
 *
 * Sans elle, l'utilisateur ne peut ni corriger sa saisie ni signaler utilement
 * le lien mort. Elle est coupée, car rien n'empêche une adresse arbitrairement
 * longue de repousser les boutons hors de l'écran ; React échappe le texte,
 * l'afficher est donc sans risque.
 */
function AttemptedPath() {
  const t = useT()
  const { pathname } = useLocation()
  const shown = pathname.length > MAX_PATH ? `${pathname.slice(0, MAX_PATH)}…` : pathname

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-body-s text-muted">{t('notFound.attempted')}</p>
      <p className="mt-1 font-mono text-body-s break-all text-ink">{shown}</p>
    </div>
  )
}

export function NotFound() {
  const t = useT()

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* En-tête réduit : le menu de la landing pointe vers des ancres qui
          n'existent pas sur cette page. Un logo et les sélecteurs suffisent. */}
      <header className="flex items-center gap-4 border-b border-border px-5 py-3 sm:px-8">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <CurrencySwitcher />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-lg">
          <p className="font-mono text-mono-label text-gold-ink">{t('notFound.code')}</p>

          <h1 className="display-m mt-3 text-balance">{t('notFound.title')}</h1>
          <p className="mt-4 text-body-l text-pretty text-muted">{t('notFound.body')}</p>

          <div className="mt-6">
            <AttemptedPath />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" to="/" iconAfter="arrowRight">
              {t('notFound.home')}
            </Button>
            <Button variant="secondary" size="lg" to="/app">
              {t('notFound.demo')}
            </Button>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <Link
              to="/connexion"
              className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-semibold text-gold-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-gold-ink-hover"
            >
              <Icon name="lock" size={15} />
              {t('notFound.signIn')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

/** Adresse inconnue à l'intérieur de l'espace de gestion : la coque est gardée. */
export function NotFoundInApp() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('notFound.appTitle')}
        description={t('notFound.appBody')}
        actions={
          <Button to="/app" iconAfter="arrowRight">
            {t('notFound.appAction')}
          </Button>
        }
      />
      <div className="max-w-lg">
        <AttemptedPath />
      </div>
    </>
  )
}
