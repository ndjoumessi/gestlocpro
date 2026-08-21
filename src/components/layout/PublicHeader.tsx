import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  /*
    LA HAUTEUR DE L'EN-TÊTE SE MESURE, elle ne se recopie pas.

    Le panneau du menu s'ouvrait sous `top-[65px]` — une valeur relevée à la
    main. Le commentaire qui l'accompagnait avouait déjà le couplage
    (« fragile — il l'était déjà »), et il avait cessé d'être juste : mesuré au
    navigateur, l'en-tête vaut 75 px sur un portable, et 131 quand la barre se
    replie. Trop petit, le panneau remonte SOUS la barre et masque le bouton
    qui le ferme — c'est-à-dire la seule sortie du menu.

    Mesurer supprime le couplage plutôt que de l'ajuster : la valeur suit la
    langue, le point de rupture et la zone sûre sans que personne ait à les
    refaire.

    LA MESURE EST PUBLIÉE EN PROPRIÉTÉ CSS, et non portée par un état React —
    c'est l'idiome que `AppShell` tient déjà pour `--h-barre-basse`. Deux
    raisons : le panneau la lit alors en feuille de style, sans qu'un nombre
    traverse le rendu ; et tout ce qui devra un jour se placer sous cette barre
    la trouvera sans redemander la mesure. Écrire une propriété ne déclenche
    aucun rendu, donc l'observateur peut suivre chaque redimensionnement sans
    coûter un cycle React par pixel.

    `useLayoutEffect` et non `useEffect` : la valeur doit être posée AVANT la
    peinture, sinon le premier cadre place le panneau sur son défaut.
  */
  useLayoutEffect(() => {
    const entete = enteteRef.current
    if (!entete) return

    const racine = document.documentElement
    const mesurer = () =>
      racine.style.setProperty('--h-entete-vitrine', `${entete.getBoundingClientRect().height}px`)
    mesurer()

    // Accolades, et non un retour implicite : `removeProperty` rend la valeur
    // qu'elle retire, et un nettoyage d'effet doit rendre `void`.
    const nettoyer = () => {
      racine.style.removeProperty('--h-entete-vitrine')
    }

    // jsdom ne connaît pas `ResizeObserver` et ne calcule aucune géométrie :
    // le repli sur `resize` garde le code montable sous le harnais.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', mesurer)
      return () => {
        window.removeEventListener('resize', mesurer)
        nettoyer()
      }
    }
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(entete)
    return () => {
      observateur.disconnect()
      nettoyer()
    }
  }, [])

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
                        /*
              LE CONTENU ENTRE DANS LA BANDE, et le repli n'est plus qu'un filet.

              Mesuré au navigateur : la rangée réclamait 1268 px pour 1216
              disponibles dans une bande plafonnée à 1280. Le déficit est
              ANTÉRIEUR au repli — il ne se voyait comme débordement du document
              qu'à 1280 pile, seule largeur où les marges tombent à zéro.
              Au-delà, le trop-plein débordait dans les marges de la page, où
              rien ne le mesurait. Le repli l'a rendu visible en le changeant de
              forme : une barre sur deux rangées, 131 px de haut, sur un
              portable ordinaire.

              Cinquante-deux pixels se rendent sans rien retirer : la marge du
              bloc de navigation, le rembourrage de ses liens, l'écart de la
              rangée. Aucun ne touche à une cible — les liens gardent leur
              plancher de 44 px, et `ecarts.test.ts` tient leur écart intérieur.

              Le repli RESTE : c'est lui qui garantit qu'aucune langue et
              aucune largeur ne feront jamais défiler la page. Il ne se
              déclenche simplement plus sur un ordinateur, et `mesure-ui` le
              vérifie désormais à chaque passage.
            */
            'mx-auto flex max-w-7xl flex-wrap items-center gap-3',
            GOUTTIERE_LATERALE,
          )}
          /*
            LE MARQUEUR EXISTE POUR LA MESURE, et il ne peut pas s'en déduire.

            `mesure-ui` tient désormais un JEU MINIMAL sur cette rangée. Un tel
            plancher n'a de sens que sur une rangée BORNÉE PAR UNE BANDE :
            ici `max-w-7xl` fige la largeur utile à 1216 px dès 1280, donc le
            jeu est une constante par langue, et un nombre de pixels veut dire
            quelque chose. Les rangées d'en-tête des écrans d'authentification
            sont en `ml-auto … justify-end` : elles épousent leur contenu, et
            leur jeu vaut zéro par construction — mesuré sur les 21 écrans. Leur
            appliquer le même plancher ferait rougir la porte sur des rangées
            qui n'ont jamais eu de place à perdre.
          */
          data-mesure="rangee-entete-vitrine"
        >
          <Logo />

          <nav aria-label={t('nav.primaryNav')} className="ml-3 hidden items-center gap-1 lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  // `whitespace-nowrap` : la barre porte quatre liens, deux
                  // boutons et celui du menu. Sans lui, le premier
                  // libellé en deux mots se coupe dès que la place manque —
                  // « Pour qui » s'affichait « Pour » au-dessus de « qui »,
                  // seul élément de la rangée à tenir sur deux lignes, ce qui
                  // désalignait toute la barre. Un lien de navigation ne se
                  // coupe pas : il rétrécit la rangée ou il disparaît.
                  'inline-flex min-h-11 items-center rounded-md px-2 text-body font-medium whitespace-nowrap',
                  'text-muted no-underline transition-colors duration-150',
                  'hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {t(section.key as 'marketing.nav.features')}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/*
              LA BARRE NE PORTE QUE CE QU'UN PROSPECT VIENT CHERCHER.

              Les trois sélecteurs vivaient ici au-delà de 1280 px et coûtaient
              393 px en français, 419 en anglais — pour un jeu restant de 12 px
              en français. Douze. La rangée tenait parce que la porte l'y
              obligeait, plus parce qu'elle avait de la place ; le prochain
              libellé traduit un peu long la faisait replier.

              Ils ne disparaissent pas, ils changent de rang : le panneau du
              menu les porte déjà, plus bas dans ce fichier, et le bouton qui
              l'ouvre est désormais visible à TOUTES les largeurs. Sans cela le
              retrait serait une régression d'accessibilité et non une
              simplification — des réglages inatteignables au grand écran.

              L'ARBITRAGE N'EST PAS QUE SPATIAL, et la mesure ne le tranche pas
              seule : 362 px de jeu restent en français après le retrait, de
              quoi rendre le thème (142 px) sans rien serrer. On ne le fait pas
              parce qu'une barre où DEUX réglages sur trois vivent au menu et le
              troisième dans la barre n'a plus de règle énonçable — or c'est la
              règle, pas le pixel, que consultera le prochain ajout. La devise
              tranchait déjà d'elle-même : le produit ne convertit pas, et
              proposer un choix sans effet est ce que ce dépôt s'interdit
              ailleurs sous le nom « jamais un nombre sans donnée derrière ».

              Les deux boutons d'inscription restent visibles dès `sm` : ce sont
              les seuls éléments de cette rangée qu'un prospect vient chercher,
              et les cacher derrière un menu sur tablette coûterait plus que la
              place qu'ils prennent.
            */}
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
            Le haut vient de la MESURE de l'en-tête, faite plus haut, et non
            d'une valeur recopiée : elle suit ainsi la langue, le point de
            rupture et la zone sûre sans que personne ait à les refaire.

            La gouttière `p-5` descend du `<nav>` vers ce conteneur : c'est lui
            qui touche les deux bords, donc c'est lui qui doit les traiter, et
            laisser le rembourrage à l'enfant reviendrait à cumuler 20 px de
            plus. Bas en `calc()` — le panneau est plein `bg-paper` et défile,
            son dernier lien a besoin d'air sous la barre de gestes.
          */
          className={cn(
            // Le panneau suit son bouton : le masquer au-delà de `xl` pendant
            // que le bouton reste visible ferait basculer un état que rien ne
            // montre — un déclencheur qui n'ouvre rien.
            'fixed inset-x-0 top-[var(--h-entete-vitrine)] bottom-0 overflow-y-auto border-t border-border bg-paper',
            'pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
            'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          )}
          style={{
            zIndex: 'var(--z-overlay)',
          }}
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
              {/* Marqué pour la mesure : la barre ayant délégué les réglages au
                  menu, une garde doit pouvoir vérifier au navigateur qu'ils y
                  sont VRAIMENT atteignables au clavier à 1440 px — sans quoi le
                  retrait ne serait qu'une disparition. */}
              <div data-mesure="reglages-vitrine" className="flex flex-wrap items-center gap-2">
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
