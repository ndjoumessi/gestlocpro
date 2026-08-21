import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'
import { LienEvitement } from './LienEvitement'
import { Logo } from '@/components/primitives/Logo'
import { Button, IconButton } from '@/components/primitives/Button'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { useT } from '@/i18n/I18nProvider'

const SECTIONS = [
  { id: 'features', key: 'marketing.nav.features' },
  { id: 'roles', key: 'marketing.nav.roles' },
  { id: 'pricing', key: 'marketing.nav.pricing' },
  { id: 'faq', key: 'marketing.nav.faq' },
] as const

export function PublicHeader() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const panneauRef = useRef<HTMLDivElement>(null)
  const enteteRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * Le menu mobile recouvre la page et fige le fond : c'est une fenêtre modale,
   * et il lui manquait tout le reste — le focus restait sur le bouton
   * d'ouverture, l'arrière-plan restait tabulable derrière le panneau, et
   * refermer laissait le focus retomber au début du document.
   *
   * Même solution que le tiroir de l'espace connecté : `inert` sur
   * l'arrière-plan plutôt qu'un piège à focus écrit à la main. Le raisonnement
   * est développé en tête de l'effet correspondant dans `AppShell.tsx`.
   *
   * Une différence, et elle commande le calcul ci-dessous : l'en-tête reste
   * VISIBLE au-dessus du panneau, qui commence sous lui, et c'est l'en-tête qui
   * porte le bouton de fermeture. Il n'est donc pas de l'arrière-plan. Ce sont
   * ses frères — le contenu de la page et le pied — qu'il faut neutraliser, ce
   * qui se lit dans le DOM sans énumérer un seul élément focalisable. Pour la
   * même raison, pas d'`aria-modal` : il masquerait aux technologies
   * d'assistance l'en-tête d'où l'on referme.
   */
  useEffect(() => {
    if (!menuOpen) return

    const declencheur = document.activeElement as HTMLElement | null
    const panneau = panneauRef.current
    const entete = enteteRef.current
    const fond = Array.from(panneau?.parentElement?.children ?? []).filter(
      (noeud) => noeud !== panneau && noeud !== entete,
    )
    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    fond.forEach((noeud) => noeud.setAttribute('inert', ''))
    panneau?.focus()

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      fond.forEach((noeud) => noeud.removeAttribute('inert'))
      document.removeEventListener('keydown', onKey)
      // Rendu au bouton d'ouverture : refermer ne doit pas laisser le focus
      // retomber sur le corps de la page, d'où l'on repartirait du début.
      declencheur?.focus()
    }
  }, [menuOpen])

  return (
    <>
      <LienEvitement />

      {/* Le rythme vertical vit sur le `<header>` et non plus sur la rangée
          intérieure : c'est lui qui va d'un bord à l'autre et porte le fond,
          donc c'est lui qui doit déborder sous la barre d'état. La rangée, elle,
          est bornée par `max-w-7xl` et ne garde que la gouttière latérale. */}
      <header
        ref={enteteRef}
        className={cn(
          'sticky top-0 border-b transition-colors duration-200',
          'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3',
          scrolled ? 'border-border bg-paper/92 backdrop-blur-md' : 'border-transparent bg-transparent',
        )}
        style={{ zIndex: 'var(--z-sticky)' }}
      >
        <div
          className={cn(
            /*
              `flex-wrap` SUR LA BARRE, et non sur ses liens.

              Le commentaire du bloc suivant interdit qu'un LIEN de navigation
              se coupe — « il rétrécit la rangée ou il disparaît » — et cette
              règle tient : les liens gardent leur `whitespace-nowrap`. Mais la
              barre, elle, peut passer à la ligne, et c'est le remède déjà
              retenu pour l'en-tête des écrans d'authentification.

              Mesuré : à 1280 px, en français, la rangée complète réclamait
              dix-neuf pixels de plus que la fenêtre — les libellés français
              étant plus longs, l'anglais passait. Un débordement qui n'existe
              que dans une langue est celui qu'une relecture ne trouve jamais.
            */
            'mx-auto flex max-w-7xl flex-wrap items-center gap-4',
            GOUTTIERE_LATERALE,
          )}
        >
          <Logo />

          <nav aria-label={t('nav.primaryNav')} className="ml-6 hidden items-center gap-1 lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  // `whitespace-nowrap` : la barre porte quatre liens, deux
                  // sélecteurs, le thème et deux boutons. Sans lui, le premier
                  // libellé en deux mots se coupe dès que la place manque —
                  // « Pour qui » s'affichait « Pour » au-dessus de « qui »,
                  // seul élément de la rangée à tenir sur deux lignes, ce qui
                  // désalignait toute la barre. Un lien de navigation ne se
                  // coupe pas : il rétrécit la rangée ou il disparaît.
                  'inline-flex min-h-11 items-center rounded-md px-3 text-body font-medium whitespace-nowrap',
                  'text-muted no-underline transition-colors duration-150',
                  'hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {t(section.key as 'marketing.nav.features')}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* `lg:flex` et non `md:flex` : c'est à `lg` que le bouton du menu
                disparaît, et le menu porte DÉJÀ ces trois sélecteurs (plus bas
                dans ce fichier). Entre 768 et 1024 px ils étaient donc affichés
                deux fois — une fois dans la barre, une fois dans le panneau —
                et la rangée de droite atteignait 676 px : toute la vitrine
                défilait latéralement, mesuré `scrollX=117` à 768 px. Les deux
                boutons d'inscription restent, eux, visibles dès `sm` : ce sont
                les seuls éléments de cette rangée qu'un prospect vient chercher,
                et les cacher derrière un menu sur tablette coûterait plus que la
                place qu'ils prennent. */}
            <div className="hidden items-center gap-2 xl:flex">
              <LanguageSwitcher />
              <CurrencySwitcher />
              <ThemeSwitcher />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" to="/connexion">
                {t('auth.signIn')}
              </Button>
              <Button to="/inscription">{t('auth.signUpFree')}</Button>
            </div>

            <IconButton
              icon={menuOpen ? 'close' : 'menu'}
              label={menuOpen ? t('marketing.nav.closeMenu') : t('marketing.nav.openMenu')}
              variant="secondary"
              onClick={() => setMenuOpen((v) => !v)}
              className="xl:hidden"
              aria-expanded={menuOpen}
            />
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          ref={panneauRef}
          data-testid="menu-mobile"
          // `tabIndex={-1}` sans quoi le panneau ne peut pas recevoir le focus
          // à l'ouverture : la tabulation suivante repartirait du début du
          // document, c'est-à-dire de l'en-tête, et non des liens du menu.
          tabIndex={-1}
          /*
            `top-[65px]` était une hauteur d'en-tête recopiée à la main. Elle
            reste juste, mais l'en-tête grandit maintenant EXACTEMENT de
            `safe-area-inset-top` : sans le même terme ici, le panneau
            remonterait sous la barre supérieure et masquerait le bouton qui le
            ferme. Le couplage est fragile — il l'était déjà — mais au moins les
            deux valeurs bougent désormais ensemble.

            La gouttière `p-5` descend du `<nav>` vers ce conteneur : c'est lui
            qui touche les deux bords, donc c'est lui qui doit les traiter, et
            laisser le rembourrage à l'enfant reviendrait à cumuler 20 px de
            plus. Bas en `calc()` — le panneau est plein `bg-paper` et défile,
            son dernier lien a besoin d'air sous la barre de gestes.
          */
          className={cn(
            'fixed inset-x-0 bottom-0 overflow-y-auto border-t border-border bg-paper xl:hidden',
            'top-[calc(65px+env(safe-area-inset-top))]',
            'pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
            'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          )}
          style={{ zIndex: 'var(--z-overlay)' }}
        >
          <nav aria-label={t('nav.primaryNav')} className="flex flex-col gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex min-h-14 items-center rounded-md px-4 title-m',
                  'text-ink no-underline transition-colors duration-150 hover:bg-surface-sunken',
                )}
              >
                {t(section.key as 'marketing.nav.features')}
              </a>
            ))}

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <LanguageSwitcher />
                <CurrencySwitcher />
                <ThemeSwitcher />
              </div>
              <Button variant="secondary" size="lg" fullWidth to="/connexion">
                {t('auth.signIn')}
              </Button>
              <Button size="lg" fullWidth to="/inscription">
                {t('auth.signUpFree')}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
