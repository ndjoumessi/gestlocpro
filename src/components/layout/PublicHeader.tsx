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
import { AU_DELA_LG, AU_DELA_SM, useAuDela } from '@/lib/useAuDela'

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
  const coucheRef = useRef<HTMLDivElement>(null)
  const panneauRef = useRef<HTMLDivElement>(null)
  const enteteRef = useRef<HTMLElement>(null)

  /*
    LE PANNEAU NE REJOUE QUE CE QUE LA BARRE NE MONTRE PAS.

    Mesuré au navigateur, menu ouvert, avant ce lot : à 1440, 1920 et 2000 px,
    les quatre liens de section étaient rendus DEUX FOIS — dans la barre et dans
    le panneau — et « Se connecter » / « Essayer gratuitement » l'étaient dès
    768 px, à 1960 px de large chacun sur un écran de 2000. Le panneau prenait
    1021 px de haut pour quatre liens et trois réglages, ses entrées commençaient
    à 20 px du bord pendant que le logo commençait à 392 : il ignorait la bande
    `max-w-7xl` que toute la page respecte.

    Les deux seuils sont ceux de la barre elle-même, pas des valeurs choisies
    ici : `lg` est l'endroit où son `<nav>` apparaît, `sm` celui où ses deux
    boutons apparaissent. Le panneau lit les mêmes, donc il ne peut pas se
    désaccorder — déplacer un point de rupture de la barre déplace le sien.

    LE RENDU, ET NON `lg:hidden` : voir l'en-tête de `useAuDela`. Un bouton
    pleine largeur caché en CSS continue de dicter la largeur naturelle du
    panneau, et un panneau « dimensionné à son contenu » ne peut pas se calculer
    sur du contenu qu'on prétend avoir retiré.
  */
  const barrePorteLesLiens = useAuDela(AU_DELA_LG)
  const barrePorteLesBoutons = useAuDela(AU_DELA_SM)

  /*
    Au-delà de `lg`, le panneau n'a plus rien d'une feuille : quatre liens et
    deux boutons lui sont retirés, il ne reste que les trois réglages. Ce n'est
    plus une fenêtre modale, c'est une liste déroulante ancrée — et les deux
    n'ont pas les mêmes devoirs. Une modale fige le fond et le neutralise ; une
    liste déroulante laisse la page vivre et se referme quand on clique
    ailleurs. Prendre l'un pour l'autre donne soit un fond figé pour trois
    boutons, soit un menu plein écran qu'on ne peut plus quitter.
  */
  const ancre = barrePorteLesLiens

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

    const entete = enteteRef.current
    const declencheur = entete?.querySelector<HTMLElement>('[data-declencheur-reglages]') ?? null
    const couche = coucheRef.current
    const panneau = panneauRef.current

    // La couche, et non le panneau : c'est elle qui est sœur de l'en-tête dans
    // le fragment. Depuis que le panneau vit à l'intérieur d'un conteneur qui
    // le borne à la bande de la page, `panneau.parentElement` ne désigne plus
    // le corps du document — il désignerait ce conteneur, dont l'unique enfant
    // est le panneau lui-même : la liste des frères à neutraliser serait vide,
    // et l'arrière-plan resterait tabulable sans qu'aucun cas ne le voie.
    const fond = Array.from(couche?.parentElement?.children ?? []).filter(
      (noeud) => noeud !== couche && noeud !== entete,
    )
    const previous = document.body.style.overflow

    // Une liste déroulante de trois réglages ne fige pas la page derrière elle
    // et ne la retire pas du clavier : ce serait le traitement d'une modale
    // pour un objet qui n'en est pas une, et le lecteur d'écran perdrait la
    // page entière le temps de changer de langue.
    if (!ancre) {
      document.body.style.overflow = 'hidden'
      fond.forEach((noeud) => noeud.setAttribute('inert', ''))
    }
    panneau?.focus()

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)

    /*
      Refermer AU CLIC DEHORS, et seulement en mode ancré : la feuille pleine
      page n'a pas de « dehors », son fond EST le panneau.

      `pointerdown` et non `click` : un clic dont l'appui a commencé dans le
      panneau et fini dehors — une sélection de texte glissée — n'a pas à
      refermer. On écoute la capture pour passer avant les `onClick` internes,
      qui peuvent démonter leur propre cible avant que l'événement ne remonte,
      auquel cas `contains` répondrait faux sur un nœud pourtant du panneau.

      Le déclencheur est exclu : sans cela son propre appui refermerait le
      panneau, et son `onClick` le rouvrirait dans la foulée — un bouton qui ne
      ferme jamais rien.
    */
    /*
      QUI REFERME DÉCIDE SI LE FOCUS REVIENT, et c'est le seul endroit d'où la
      question se tranche.

      On ne peut pas la poser au nettoyage : les effets passifs s'exécutent
      APRÈS la mutation du DOM, donc le panneau y est déjà démonté, son focus
      déjà retombé sur `<body>`, et « le focus était-il dedans ? » répond
      toujours non. Mesuré : les deux cas de retour du focus tombaient
      ensemble.

      Le drapeau nomme la règle plutôt que de la déduire d'un état perdu :
      Échap, le déclencheur et le franchissement du seuil rendent le focus —
      sans quoi il repartirait du début du document ; le clic dehors ne le rend
      pas — l'utilisateur a désigné où il allait, et le lui reprendre ferait du
      panneau une souricière à la souris.
    */
    let rendreLeFocus = true
    const onDehors = (e: PointerEvent) => {
      const cible = e.target as Node | null
      if (!cible) return
      if (panneau?.contains(cible)) return
      if (declencheur?.contains(cible)) return
      rendreLeFocus = false
      setMenuOpen(false)
    }
    if (ancre) document.addEventListener('pointerdown', onDehors, true)

    return () => {
      document.body.style.overflow = previous
      fond.forEach((noeud) => noeud.removeAttribute('inert'))
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDehors, true)
      // Rendu au bouton d'ouverture : refermer ne doit pas laisser le focus
      // retomber sur le corps de la page, d'où l'on repartirait du début.
      // Sauf sortie par le dehors — voir le drapeau, plus haut.
      if (rendreLeFocus) declencheur?.focus()
    }
  }, [menuOpen, ancre])

  /*
    Franchir le seuil pendant que le panneau est ouvert le referme.

    Le contenu du panneau CHANGE au passage de `lg` — les liens et les boutons
    y entrent ou en sortent. Le laisser ouvert ferait muter sous le doigt un
    objet dont la forme, la position et les devoirs clavier viennent tous de
    changer ; et l'effet ci-dessus a déjà rendu le focus au déclencheur en se
    rejouant. `AppShell` referme son tiroir au même seuil, pour la raison
    jumelle.
  */
  useEffect(() => setMenuOpen(false), [ancre, barrePorteLesBoutons])

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

            {/* Le nom suit ce que le bouton OUVRE VRAIMENT, qui n'est plus le
                même des deux côtés du seuil : au-delà de `lg` il n'ouvre plus
                un menu — les liens sont dans la barre, les boutons aussi — mais
                trois réglages. « Ouvrir le menu » y annoncerait une navigation
                que le panneau ne contient pas, et le hamburger la dessinerait. */}
            <IconButton
              icon={menuOpen ? 'close' : ancre ? 'sliders' : 'menu'}
              label={
                ancre
                  ? menuOpen
                    ? t('marketing.nav.closeSettings')
                    : t('marketing.nav.openSettings')
                  : menuOpen
                    ? t('marketing.nav.closeMenu')
                    : t('marketing.nav.openMenu')
              }
              variant="secondary"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              /*
                LE DÉCLENCHEUR SE DÉSIGNE, il ne se devine pas.

                L'effet d'ouverture le retrouvait par `document.activeElement`.
                C'était juste tant qu'il n'en faisait qu'une chose — rendre le
                focus —, et Chrome focalise un bouton qu'on clique. Le clic
                dehors, lui, doit EXCLURE ce bouton, faute de quoi son propre
                appui referme le panneau que son `onClick` rouvre aussitôt ; et
                sur un navigateur qui ne focalise pas les boutons au clic,
                `activeElement` vaut `<body>`, qui contient tout — l'exclusion
                avalerait alors la page entière et plus rien ne refermerait.

                `mesure-ui` a déjà payé cette leçon en prenant le sélecteur de
                devise pour le déclencheur du menu : « un grief exact sur un
                fait faux ». On nomme.
              */
              data-declencheur-reglages=""
            />
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          ref={coucheRef}
          /*
            LA COUCHE N'EST PAS LE PANNEAU, depuis que le panneau ne va plus d'un
            bord à l'autre. Elle porte deux choses, et rien d'autre : le haut
            MESURÉ de l'en-tête — jamais une valeur recopiée, elle suit ainsi la
            langue, le point de rupture et la zone sûre — et la bande
            `max-w-7xl` de la page, sur laquelle le panneau ancré vient
            s'aligner à droite comme le logo s'aligne à gauche.

            En mode ancré elle ne reçoit AUCUN clic : elle couvre la page entière
            et l'avaler ferait d'une liste déroulante un voile invisible, où le
            premier lien de la page cesserait de répondre. Le panneau se rend le
            clic pour lui seul.
          */
          className={cn(
            'fixed inset-x-0 top-[var(--h-entete-vitrine)]',
            ancre
              ? cn('pointer-events-none mx-auto max-w-7xl', GOUTTIERE_LATERALE)
              : 'bottom-0 flex',
          )}
          style={{ zIndex: 'var(--z-overlay)' }}
        >
          <div
            ref={panneauRef}
            data-testid="menu-mobile"
            // `tabIndex={-1}` sans quoi le panneau ne peut pas recevoir le focus
            // à l'ouverture : la tabulation suivante repartirait du début du
            // document, c'est-à-dire de l'en-tête, et non des liens du menu.
            tabIndex={-1}
            className={cn(
              ancre
                ? /*
                    ANCRÉ ET DIMENSIONNÉ À SON CONTENU. `w-max` prend la largeur
                    que les trois réglages réclament — mesurée à 407 px en
                    français, 433 en anglais — au lieu des 1960 px que la feuille
                    prenait sur un écran de 2000. `ml-auto` le colle au bord
                    droit de la bande, c'est-à-dire sous le bouton qui l'ouvre.

                    `max-w-full` reste le filet : la bande est bornée à 1280 px
                    et le contenu à ~433, donc il ne sert jamais aujourd'hui — il
                    servira le jour où un quatrième réglage arrivera, et il vaut
                    mieux qu'il rétrécisse que qu'il déborde.

                    L'ombre et le rayon sont ceux des listes déroulantes du
                    dépôt (`CurrencySwitcher`) : le panneau flotte désormais
                    au-dessus de la page au lieu de la remplacer, et rien ne
                    l'en détacherait sans elles.

                    CE N'EST PAS `Card`, ET LA RÉFÉRENCE N'Y EST POUR RIEN.
                    `Card` relaie désormais la sienne, donc la référence ne
                    bloque plus rien — le blocage est ailleurs, et il est
                    structurel : les DEUX branches ci-contre sont le MÊME
                    élément. Celui-ci porte la référence, `tabIndex`, le
                    `data-testid` et toute la navigation ; seule la branche
                    ancrée ressemble à une carte, l'autre est une feuille pleine
                    largeur en `bg-paper` sans rayon ni ombre. Appeler `Card`
                    obligerait à écrire l'élément — et son contenu — deux fois,
                    ou à l'envelopper d'un conteneur qui n'existe que pour la
                    moitié des tailles d'écran. Une carte conditionnelle n'est
                    pas une carte : c'est une des deux peaux d'un panneau.
                  */
                  cn(
                    'pointer-events-auto ml-auto mt-2 w-max max-w-full',
                    'rounded-lg border border-divider bg-surface p-4 shadow-e3',
                  )
                : /*
                    LA FEUILLE NE CHANGE PAS : en deçà de `lg` elle est juste.
                    Elle prend tout, elle défile, et son dernier bouton a besoin
                    d'air sous la barre de gestes — d'où le bas en `calc()`.
                  */
                  cn(
                    'w-full overflow-y-auto border-t border-border bg-paper',
                    'pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
                    GOUTTIERE_LATERALE,
                  ),
            )}
          >
            <nav aria-label={t('nav.primaryNav')} className="flex flex-col gap-1">
              {/*
                Les liens de section ne sont rendus QUE si la barre ne les
                montre pas. Au-delà de `lg` ils y sont, et les répéter ici
                obligeait le regard à choisir entre deux navigations identiques
                — sans compter les 1021 px de haut que le panneau prenait pour
                les afficher une seconde fois.
              */}
              {!barrePorteLesLiens &&
                SECTIONS.map((section) => (
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

              {/*
                Le filet ne se dessine que s'il sépare quelque chose : sans les
                liens au-dessus, une bordure haute ne délimiterait rien et la
                marge ouvrirait un vide en tête d'un panneau qui tient en trois
                boutons.
              */}
              <div
                className={cn(
                  'flex flex-col gap-3',
                  !barrePorteLesLiens && 'mt-4 border-t border-border pt-5',
                )}
              >
                {/* Marqué pour la mesure : la barre ayant délégué les réglages au
                    menu, une garde doit pouvoir vérifier au navigateur qu'ils y
                    sont VRAIMENT atteignables au clavier à 1440 px — sans quoi le
                    retrait ne serait qu'une disparition. */}
                <div data-mesure="reglages-vitrine" className="flex flex-wrap items-center gap-2">
                  <LanguageSwitcher />
                  <CurrencySwitcher />
                  <ThemeSwitcher />
                </div>

                {/*
                  Mêmes règles pour les deux boutons, à leur propre seuil : la
                  barre les montre dès `sm`, donc le panneau ne les reprend qu'en
                  deçà. C'est là aussi qu'ils sont pleine largeur à bon droit —
                  sur un téléphone. Deux boutons de 1960 px sur un écran de 2000
                  ne disaient pas « important », ils disaient « personne n'a
                  regardé ».
                */}
                {!barrePorteLesBoutons && (
                  <>
                    <Button variant="secondary" size="lg" fullWidth to="/connexion">
                      {t('auth.signIn')}
                    </Button>
                    <Button size="lg" fullWidth to="/inscription">
                      {t('auth.signUpFree')}
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
