import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'
import { LienEvitement } from './LienEvitement'
import { CadreContext } from './PageHeader'
import { Logo } from '@/components/primitives/Logo'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { Button, IconButton } from '@/components/primitives/Button'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import type { CurrencyCode } from '@/currency/currencies'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { useT } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { lien, useBase } from '@/lib/base'


/* -------------------------------------------------------------------------- */
/* Rôle actif — pilote ce que la barre latérale montre et ce que les écrans
   autorisent.                                                                 */
/* -------------------------------------------------------------------------- */

interface RoleContextValue {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextValue>({ role: 'owner', setRole: () => {} })

export function useRole() {
  return useContext(RoleContext)
}

/**
 * Monte de VRAIS écrans du locataire dans une fenêtre de démonstration.
 *
 * La prévisualisation entretenait sa propre copie des trois vues — cartes de
 * quittances, liste de documents, formulaire de signalement. Une copie ne se
 * met pas à jour : la grille par période, le dossier du logement, le détail des
 * états des lieux et la consommation sur douze mois l'ont tous contournée. Pire,
 * elle avait DIVERGÉ — quatre corps de métier là où le produit en compte cinq,
 * et des urgences qui n'existaient nulle part ailleurs.
 *
 * Le rôle forcé n'est pas du confort, c'est ce que la prévisualisation
 * SIGNIFIE : le propriétaire regarde ce que voit son locataire. Sans lui,
 * `Signaler` borne son formulaire à `role === 'tenant'` — « le bailleur ne
 * signale pas un problème chez quelqu'un d'autre, il le reçoit » — et le cadre
 * n'afficherait qu'un état vide.
 *
 * `setRole` est neutre : le cadre MONTRE un profil, on n'en change pas depuis
 * l'intérieur. Une bascule y serait une commande sans destination.
 */
export function DansUnCadre({ children }: { children: ReactNode }) {
  return (
    <CadreContext.Provider value={true}>
      <RoleContext.Provider value={{ role: 'tenant', setRole: () => {} }}>
        {children}
      </RoleContext.Provider>
    </CadreContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */

interface NavItem {
  /**
   * Chemin RELATIF à la base — `'parc'`, et `''` pour le tableau de bord.
   *
   * Absolu auparavant (`/app/parc`), il enfermait la navigation dans une seule
   * adresse : la démonstration ne pouvait pas vivre ailleurs sans que chaque
   * lien la ramène dans l'espace réel.
   */
  to: string
  labelKey: string
  icon: IconName
  /**
   * Compteur dérivé de l'état, désigné par son nom et non par sa valeur.
   *
   * Les deux pastilles étaient des littéraux — `'3'` et `'2'`. Elles ne
   * pouvaient donc jamais changer : marquer toutes les alertes comme lues
   * laissait « 2 » dans la barre latérale, et encaisser un impayé laissait
   * « 3 » à côté des paiements.
   */
  badge?: { count: 'overdue' | 'unreadAlerts'; tone: 'danger' | 'onDark' }
  /** Rôles auxquels l'entrée est proposée. */
  roles?: Role[]
  /**
   * Entrée de VITRINE : elle ne mène pas à une fonction du produit, mais à une
   * page qui montre le produit. Réservée à la démonstration.
   *
   * Ce champ existe parce que son absence se voyait : le groupe de pied était
   * le seul à ne déclarer aucune condition, et s'affichait donc pour tout le
   * monde. Le déclarer force la question à chaque entrée ajoutée.
   */
  vitrine?: boolean
}

const SECTIONS: { headingKey: string; items: NavItem[] }[] = [
  {
    headingKey: 'nav.sectionSteering',
    items: [
      { to: '', labelKey: 'nav.dashboard', icon: 'grid' },
      { to: 'parc', labelKey: 'nav.portfolio', icon: 'building', roles: ['owner', 'manager'] },
    ],
  },
  {
    headingKey: 'nav.sectionOperations',
    items: [
      {
        to: 'paiements',
        labelKey: 'nav.payments',
        icon: 'card',
        badge: { count: 'overdue', tone: 'danger' },
      },
      /* Le locataire voit LES SIENS : l'eau et l'électricité lui sont
         refacturées, et le portefeuille borne déjà les relevés à son unité. */
      { to: 'releves', labelKey: 'nav.meters', icon: 'gauge' },
      { to: 'etats-des-lieux', labelKey: 'nav.inspections', icon: 'clipboard' },
      { to: 'travaux', labelKey: 'nav.works', icon: 'wrench' },
      /* Sa caution est SON argent. La lui cacher jusqu'à la restitution est
         exactement ce que ce produit reproche aux pratiques qu'il remplace. */
      { to: 'cautions', labelKey: 'nav.deposits', icon: 'shield' },
    ],
  },
  {
    headingKey: 'nav.sectionAdmin',
    items: [
      { to: 'locataires', labelKey: 'nav.tenants', icon: 'users', roles: ['owner', 'manager'] },
      { to: 'acces', labelKey: 'nav.access', icon: 'key', roles: ['owner', 'manager'] },
      {
        to: 'signalements',
        labelKey: 'nav.alerts',
        icon: 'bell',
        badge: { count: 'unreadAlerts', tone: 'onDark' },
      },
      { to: 'prise-en-main', labelKey: 'nav.onboarding', icon: 'info', roles: ['owner'] },
    ],
  },
]

/**
 * La navigation du LOCATAIRE — trois entrées, et pas une version filtrée de
 * celle du bailleur.
 *
 * Elle en était une : le filtrage par rôle laissait passer huit entrées
 * — tableau de bord, paiements, relevés, états des lieux, travaux, cautions,
 * signalements, signaler — rangées sous « Pilotage », « Opérations » et
 * « Administration ». Ces trois titres nomment le métier de qui gère un parc.
 * Un locataire n'exploite rien : il habite.
 *
 * Les écrans repliés ne sont pas fermés, ils quittent la NAVIGATION. Leur
 * contenu remonte dans les trois entrées — les relevés et les paiements dans
 * « Mon espace », la caution et l'état des lieux dans « Documents » — et les
 * adresses restent atteignables en direct, cloisonnées comme avant par
 * `tenantIsolation`. Rien de ce qu'une session précédente a ouvert au locataire
 * ne se referme ici : sa caution reste son argent, ses relevés restent les
 * siens, ils cessent seulement d'être des destinations.
 */
const SECTIONS_LOCATAIRE: { headingKey: string; items: NavItem[] }[] = [
  {
    headingKey: 'nav.sectionMySpace',
    items: [
      { to: 'mon-espace', labelKey: 'nav.mySpace', icon: 'grid' },
      { to: 'documents', labelKey: 'nav.documents', icon: 'file' },
      /* « Signaler » est au locataire ce que « Signalements » est au bailleur :
         l'un déclare, l'autre reçoit. Deux écrans, deux rôles, un seul objet. */
      { to: 'signaler', labelKey: 'nav.report', icon: 'bell' },
    ],
  },
]

/** La navigation tient au rôle, et non à un filtre posé sur celle d'un autre. */
function sectionsPour(role: Role) {
  return role === 'tenant' ? SECTIONS_LOCATAIRE : SECTIONS
}

/** Toutes les entrées atteignables par ce rôle, sections et pied confondus. */
function toutesLesEntrees(role: Role): NavItem[] {
  return [...sectionsPour(role).flatMap((s) => s.items), ...FOOTER_ITEMS]
}

/**
 * Les deux vitrines, et rien d'autre.
 *
 * « Portail locataire » est une MAQUETTE — « ce que voit votre locataire depuis
 * son navigateur », avec une adresse factice — d'un produit qui n'existe pas
 * encore. « États du système » est la démonstration des états que l'interface
 * sait afficher ; son propre dictionnaire le dit, à propos de « Rejouer » :
 * « le verbe dit qu'on est dans une vitrine ».
 *
 * Elles s'affichaient pourtant sur les vrais comptes, et l'une d'elles offre
 * « Repartir du jeu de démonstration » — un bouton qui remplace le parc de
 * l'utilisateur, à l'écran, par celui de la démonstration. Rien n'est écrit au
 * serveur et un rechargement rend les vraies données, mais d'ici là un
 * propriétaire regarde le parc de quelqu'un d'autre.
 */
const FOOTER_ITEMS: NavItem[] = [
  { to: 'portail', labelKey: 'nav.tenantPortal', icon: 'monitor', vitrine: true },
  { to: 'systeme', labelKey: 'nav.system', icon: 'layers', vitrine: true },
]

/** Ce qu'un contexte donné a le droit de montrer : rôle ET nature de l'entrée. */
function entreesVisibles(items: NavItem[], role: Role, demo: boolean): NavItem[] {
  return items.filter(
    (item) => (!item.roles || item.roles.includes(role)) && (!item.vitrine || demo),
  )
}

/**
 * Ordre de priorité de la barre basse, du plus utile au moins.
 *
 * Quatre destinations, plus « Plus » qui ouvre le tiroir : cinq cibles est le
 * maximum tenable (règle Material, et à 360 px une sixième descend sous les
 * 44 px). La navigation en compte une douzaine — il faut donc choisir, et le
 * tiroir reste le seul endroit où elle est complète.
 *
 * Le choix : le tableau de bord parce qu'on y revient ; paiements et
 * signalements parce que ce sont les deux entrées qui PORTENT UN COMPTEUR,
 * c'est-à-dire les deux seules qui réclament quelque chose — une barre basse
 * qui ne montrerait pas les impayés du jour ne servirait qu'à naviguer, jamais
 * à alerter ; puis le parc, surface de travail de qui gère du stock.
 *
 * La liste est plus longue que quatre parce qu'elle est FILTRÉE PAR RÔLE avant
 * d'être coupée : le parc disparaît pour un locataire, et les travaux — son
 * seul vrai motif d'ouvrir l'application après le loyer — remontent prendre la
 * place au lieu de laisser un trou. Un rôle qui n'aurait que deux entrées
 * donnerait une barre à deux entrées, correcte quoique clairsemée.
 */
const BOTTOM_ORDER = ['', 'paiements', 'signalements', 'parc', 'travaux'] as const

/** Nombre de destinations, « Plus » non compris — cinq cibles au total. */
const BOTTOM_MAX = 4

/**
 * Qui regarde, et quel parc.
 *
 * Ces deux informations étaient écrites en dur dans la coquille : « Parc
 * Arsène N. · Douala » sous le logo, « Arsène N. » dans le sélecteur de profil,
 * « Douala » dans le fil d'Ariane. Elles s'affichaient donc **aussi pour un
 * compte réel** — un propriétaire découvrait son espace au nom et à la ville de
 * quelqu'un d'autre, et ne pouvait plus le distinguer de la démonstration,
 * puisque les deux annonçaient la même identité.
 *
 * Le garde des identifiants techniques ne pouvait pas le voir : il cherche des
 * `uuid`, et « Arsène N. » n'en est pas un. C'est la même famille de défaut —
 * une constante de démonstration qui survit au branchement des vraies données —
 * mais elle passe sous un filet à mailles trop larges.
 *
 * La ville a disparu plutôt que d'être devinée : le modèle ne la porte pas, et
 * en inventer une est exactement ce qui a produit ce défaut.
 */
function useIdentite(): { parc: string | null; nom: string | null; demo: boolean } {
  const { etat, estDemo, adhesionActive } = useSession()
  const t = useT()

  if (estDemo) return { parc: t('common.demoPark'), nom: null, demo: true }
  if (etat.statut === 'connecte') {
    return {
      // Première adhésion : un compte multi-parcs choisira le sien le jour où
      // le produit saura en gérer plusieurs. Afficher un nom faux en attendant
      // serait le défaut qu'on corrige ici.
      parc: adhesionActive?.parkName ?? null,
      nom: etat.compte.fullName,
      demo: false,
    }
  }
  return { parc: null, nom: null, demo: false }
}

export function AppShell() {
  const t = useT()
  const location = useLocation()
  /**
   * Le rôle vient de l'ADHÉSION, pas d'un défaut.
   *
   * Il était fixé à `'owner'` en dur, alors que la session porte le vrai rôle
   * depuis toujours. Un gestionnaire ou un locataire qui se connectait recevait
   * donc la navigation d'un propriétaire — « Parc immobilier », « Cautions »,
   * « Prise en main et droits », entrées qu'il ne peut pas servir. Le serveur
   * refusait bien les données, mais la barre latérale promettait l'inverse.
   *
   * En démonstration il n'y a pas d'adhésion : on garde « propriétaire », d'où
   * part le parcours, et le sélecteur reste là pour en changer.
   */
  const { etat: session, adhesionActive } = useSession()
  const { setCurrency } = useCurrency()

  /**
   * La devise vient du PARC, pas d'une préférence de navigateur.
   *
   * `CurrencyProvider` ne lisait que `localStorage` : la devise du parc, portée
   * par l'adhésion depuis toujours, n'était lue nulle part. Un parc camerounais
   * s'affichait donc dans la dernière devise choisie sur cette machine — et une
   * QUITTANCE imprimait « 50,00 € » pour 50 000 FCFA, soit un écart de 655 fois
   * sur un document opposable au locataire.
   *
   * Le produit ne convertit rien, et c'est un parti pris assumé du module de
   * devises. Il ne tient que si la devise affichée EST celle du parc : sans
   * conversion, en changer ne fait que mentir sur l'unité.
   *
   * `XAF` et `XOF` partagent le même « CFA » à l'écran — deux monnaies
   * distinctes, même parité, et le produit n'affiche que des montants.
   */
  const deviseDuParc: CurrencyCode | null =
    session.statut === 'connecte'
      ? (({ XAF: 'CFA', XOF: 'CFA', EUR: 'EUR', CAD: 'CAD', USD: 'USD' } as const)[
          adhesionActive?.currency as 'XAF' | 'XOF' | 'EUR' | 'CAD' | 'USD'
        ] ?? null)
      : null

  useEffect(() => {
    if (deviseDuParc) setCurrency(deviseDuParc)
  }, [deviseDuParc, setCurrency])
  const roleDuCompte: Role =
    session.statut === 'connecte' ? (adhesionActive?.role ?? 'owner') : 'owner'

  const [role, setRole] = useState<Role>(roleDuCompte)

  // La session arrive après le premier rendu : sans cette synchronisation, le
  // rôle resterait celui deviné avant sa résolution. L'effet ne se rejoue qu'au
  // CHANGEMENT de l'adhésion, il n'écrase donc pas le choix fait au sélecteur.
  useEffect(() => setRole(roleDuCompte), [roleDuCompte])
  const [railed, setRailed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // La navigation mobile se referme au changement de page : sans cela, le
  // panneau reste ouvert par-dessus l'écran qu'on vient de demander.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  // Le tiroir n'existe qu'en deçà de `lg`. Sans cette fermeture, un passage en
  // grand écran laisserait l'état ouvert : l'arrière-plan resterait neutralisé
  // alors que plus rien ne le recouvre.
  useEffect(() => {
    if (!drawerOpen) return
    const large = window.matchMedia('(min-width: 64rem)')
    const onChange = () => large.matches && setDrawerOpen(false)
    onChange()
    large.addEventListener('change', onChange)
    return () => large.removeEventListener('change', onChange)
  }, [drawerOpen])

  /**
   * Le tiroir se comportait comme une fenêtre modale sans en avoir les
   * obligations : le focus restait sur le bouton d'ouverture, et sept éléments
   * de la page restaient atteignables au clavier derrière l'assombrissement.
   * Un utilisateur au clavier tabulait donc dans du contenu qu'il ne voyait
   * pas.
   *
   * `inert` sur le contenu retire d'un coup tout l'arrière-plan du parcours de
   * tabulation — plus sûr qu'un piège à focus écrit à la main, qui doit
   * énumérer les éléments focalisables et se trompe dès qu'un composant en
   * ajoute un.
   */
  useEffect(() => {
    if (!drawerOpen) return

    const declencheur = document.activeElement as HTMLElement | null
    const contenu = contentRef.current
    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    contenu?.setAttribute('inert', '')
    drawerRef.current?.focus()

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      contenu?.removeAttribute('inert')
      document.removeEventListener('keydown', onKey)
      // Rendu au bouton d'ouverture : refermer ne doit pas laisser le focus
      // retomber sur le corps de la page, d'où l'on repartirait du début.
      declencheur?.focus()
    }
  }, [drawerOpen])

  /**
   * La barre basse DIT sa hauteur au reste de la page.
   *
   * Elle est `fixed` : elle ne pousse rien, et tout ce qui vit au bord bas la
   * traverse sans le savoir. Le bandeau « nouvelle version » — rendu hors de
   * `<App />` par `main.tsx`, donc frère SUIVANT, à `var(--z-sticky)` égal —
   * la recouvrait entièrement : à 375 px, barre à top=759, bandeau à top=716,
   * et `elementFromPoint` au centre du bord bas rendait « Recharger » au lieu
   * du lien. Les cinq destinations mobiles disparaissaient le jour d'un
   * déploiement, c'est-à-dire le jour où l'on a le plus besoin de naviguer.
   *
   * Le jeton est posé sur `<html>` et non passé en prop, pour la raison même
   * qui a sorti le bandeau de `<App />` : les deux n'ont aucun arbre commun.
   * `document.body.style` sert déjà de canal à l'ouverture du tiroir, quelques
   * dizaines de lignes plus haut — c'est le même geste, au même endroit.
   *
   * `useLayoutEffect` et non `useEffect` : `main` réserve désormais sa marge
   * basse depuis ce même jeton, et un effet passif l'écrirait APRÈS la
   * première peinture — 64 px de rembourrage qui apparaîtraient d'un coup sous
   * le premier écran mobile venu. Il n'y a pas de rendu serveur ici, donc pas
   * d'avertissement à redouter.
   *
   * Le LOCATAIRE est rendu par la branche ci-dessous, qui ne monte aucune
   * barre basse : lui élever le bord décollerait le bandeau de 64 px pour
   * rien.
   */
  useLayoutEffect(() => {
    if (role === 'tenant') return
    const racine = document.documentElement
    racine.style.setProperty('--h-barre-basse', 'var(--h-barre-basse-montee)')
    // Accolades, et non un retour implicite : `removeProperty` rend la valeur
    // qu'elle retire, et un nettoyage d'effet doit rendre `void`.
    return () => {
      racine.style.removeProperty('--h-barre-basse')
    }
  }, [role])

  /**
   * Le LOCATAIRE n'a pas de barre latérale : il a une barre en haut.
   *
   * Sa navigation vivait dans la coquille du bailleur — le même panneau
   * vertical sombre, réduit à trois entrées. Les maquettes du portail montrent
   * tout autre chose : une barre horizontale, logo à gauche, ses trois
   * destinations au centre, son identité à droite. La différence n'est pas
   * décorative. Un panneau latéral rangé par sections — « Pilotage »,
   * « Opérations » — est l'outil de qui exploite un parc et navigue entre douze
   * écrans ; le locataire en a trois, et il habite.
   *
   * Toute la mécanique de la coquille de gestion tombe avec elle : ni tiroir,
   * ni voile, ni barre basse, ni bouton « Plus » — qui, chez lui, dépliait une
   * navigation contenant exactement les trois entrées déjà affichées. Une
   * seule navigation, au même endroit à toutes les tailles.
   */
  if (role === 'tenant') {
    return (
      <RoleContext.Provider value={{ role, setRole }}>
        <div className="flex min-h-dvh flex-col bg-paper">
          {/* Le lien d'évitement reste la première halte : ici il fait sauter
              la barre supérieure, et rien ne le neutralise puisqu'il n'y a plus
              de tiroir pour recouvrir la page. */}
          <LienEvitement />
          <BarreLocataire setRole={setRole} />
          <BandeauDemo />
          <main
            id="main"
            className={cn(
              'animate-rise flex-1',
              // Aucune barre basse à réserver — d'où un simple rembourrage de
              // fin de défilement, zone de gestes comprise.
              'pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
              'sm:pt-8 sm:pb-[calc(2rem+env(safe-area-inset-bottom))]',
              GOUTTIERE_LATERALE,
            )}
          >
            <Outlet />
          </main>
        </div>
      </RoleContext.Provider>
    )
  }

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <div className="flex min-h-dvh items-stretch">
        {/*
          Avant la barre latérale, et non dans la colonne de contenu : c'est
          justement la barre latérale que le lien fait sauter, un lien placé
          après elle n'éviterait plus rien. Il n'est donc pas non plus couvert
          par l'`inert` du tiroir, qui ne porte que sur cette colonne — d'où le
          retrait pur et simple quand le tiroir est ouvert. Le laisser tabulable
          derrière le voile enverrait le focus vers un contenu neutralisé.

          La barre basse, ajoutée depuis, ne change pas ce raisonnement : elle
          vit en fin de colonne de contenu, donc après le contenu dans l'ordre
          de tabulation. Le lien reste la première halte.
        */}
        {!drawerOpen && <LienEvitement />}

        <Sidebar
          role={role}
          setRole={setRole}
          railed={railed}
          onToggleRail={() => setRailed((v) => !v)}
          className="hidden lg:flex"
        />

        {drawerOpen && (
          <>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 cursor-default bg-scrim backdrop-blur-[2px] lg:hidden"
              style={{ zIndex: 'var(--z-overlay)' }}
            />
            <Sidebar
              role={role}
              setRole={setRole}
              railed={false}
              onToggleRail={() => setDrawerOpen(false)}
              className="fixed inset-y-0 left-0 flex w-72 lg:hidden"
              style={{ zIndex: 'var(--z-overlay)' }}
              dialogLabel={t('nav.primaryNav')}
              innerRef={drawerRef}
            />
          </>
        )}

        <div ref={contentRef} className="flex min-w-0 flex-1 flex-col bg-paper">
          <Topbar onOpenDrawer={() => setDrawerOpen(true)} />
          <BandeauDemo />
          {/*
            Le contenu coule, il n'est ni collant ni fixe — mais avec
            `viewport-fit=cover` le bas du document EST le bas physique de
            l'écran, et les 24 px de `py-6` ne suffisaient plus à dégager les
            34 px de la barre de gestes : la dernière ligne d'un tableau, le
            dernier bouton d'un formulaire finissaient dessous.

            `calc()` et non `max()` : ici rien n'est peint, le fond `bg-paper`
            venant du parent. Le rembourrage n'est que de la respiration de fin
            de défilement, et `max()` poserait le dernier élément pile au ras de
            la barre de gestes — techniquement hors zone réservée, désagréable à
            lire. Latéralement `max()`, en revanche : sous `lg` la barre
            latérale disparaît et cette colonne prend toute la largeur, encoche
            de paysage comprise.
          */}
          <main
            id="main"
            className={cn(
              'animate-rise flex-1',
              // Le bas réserve EN PLUS la hauteur de la barre basse, qui est
              // `fixed` et ne pousse donc rien : sans cette réserve elle
              // recouvrirait la dernière ligne de chaque page — exactement le
              // défaut que le rembourrage de zone sûre venait de corriger.
              //
              // La mesure ne s'écrit plus ici. Ce `4rem` était recopié à deux
              // points de rupture, et le bandeau de version — qui doit
              // s'écarter de la MÊME barre — n'y avait aucun accès : la barre
              // le recouvrait, et rien ne reliait les deux écritures. Le jeton
              // est cette liaison. Il retombe à 0 à partir de `lg`, où la
              // barre est masquée, et la ligne `lg:` qui ne servait qu'à
              // retrancher ces 4rem disparaît avec lui.
              //
              // Un jeton, et non une constante interpolée : Tailwind lit les
              // sources comme du TEXTE, et un `${…}` dans un nom de classe ne
              // produit aucun utilitaire. C'est une panne silencieuse — le CSS
              // manque, rien ne le dit.
              'pt-6 pb-[calc(1.5rem+var(--h-barre-basse)+env(safe-area-inset-bottom))]',
              'sm:pt-8 sm:pb-[calc(2rem+var(--h-barre-basse)+env(safe-area-inset-bottom))]',
              // Latéralement, la gouttière commune : sous `lg` la barre
              // latérale disparaît et cette colonne prend toute la largeur,
              // encoche de paysage comprise.
              GOUTTIERE_LATERALE,
            )}
          >
            <Outlet />
          </main>

          {/*
            La barre basse vit DANS la colonne de contenu, et non à côté : elle
            hérite ainsi de l'`inert` posé à l'ouverture du tiroir. Elle est
            derrière le voile, il serait faux qu'elle reste tabulable.
          */}
          <BarreBasse role={role} onOpenDrawer={() => setDrawerOpen(true)} />
        </div>
      </div>
    </RoleContext.Provider>
  )
}

/**
 * La barre du locataire — UNE barre, sombre, en haut.
 *
 * Portée depuis la prévisualisation `/portail`, qui la rendait déjà : logo,
 * destinations, identité sur un seul bandeau d'encre. Ce qui NE traverse pas :
 *
 * — **Le motif `tab`.** La prévisualisation montre trois vues exclusives d'un
 *   même dossier, et tient pour cela le motif ARIA complet, flèches comprises.
 *   Ici les trois entrées sont trois ADRESSES : ce sont des liens, et un lecteur
 *   d'écran doit entendre « lien », pas « onglet ». Déclarer `role="tab"` sur
 *   une navigation promettrait des flèches qui ne mènent nulle part — la règle
 *   du dépôt vaut dans les deux sens : le motif se tient en entier, ou pas du
 *   tout.
 *
 * — **La cloche.** Elle est `aria-hidden` dans la prévisualisation, où elle est
 *   assumée comme décor. Une barre réelle ne peut pas porter un décor en forme
 *   de commande : le locataire n'a aucune file de notifications à ouvrir — son
 *   icône `bell` est celle de « Signaler », qui est déjà là. Un bouton qui
 *   n'ouvre rien est le défaut que les « Télécharger » de l'écran Documents ont
 *   déjà coûté une fois.
 *
 * Ce qui traverse, en revanche : la pastille d'identité, qui devient le vrai
 * menu du compte — celui qui dit qui est connecté et permet d'en sortir.
 */
function BarreLocataire({ setRole }: { setRole: (role: Role) => void }) {
  const t = useT()
  const base = useBase()
  const { demo } = useIdentite()

  const items = entreesVisibles(
    sectionsPour('tenant').flatMap((section) => section.items),
    'tenant',
    demo,
  )

  return (
    <header
      /**
       * `on-dark` sur le conteneur, mais les libellés portent `text-on-dark`
       * EN TOUTES LETTRES.
       *
       * Le remappage de `.on-dark` est écrit `:not([class*='bg-'])` : il se
       * retire de lui-même dès qu'un élément porte son propre fond — ce qui est
       * le cas de l'entrée courante et du survol. S'y fier rendait le libellé
       * actif invisible, encre sur encre. La prévisualisation s'y est déjà
       * brûlée ; son commentaire le raconte.
       *
       * Collante et peinte jusqu'au bord physique : avec `viewport-fit=cover`,
       * `top-0` est le haut de l'écran, et sans le `calc()` le logo se range
       * sous la barre d'état. Latéralement `max()`, la barre allant d'un bord à
       * l'autre — en paysage l'encoche mord d'un côté ou de l'autre.
       */
      className={cn(
        'on-dark sticky top-0 flex flex-wrap items-center gap-x-2 gap-y-1 bg-ink',
        'pt-[calc(0.625rem+env(safe-area-inset-top))]',
        'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
        'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <Logo to={base} size="sm" tone="dark" className="mr-4 mb-2.5" />

      <nav
        aria-label={t('nav.primaryNav')}
        // `overflow-x-auto` plutôt qu'un repli : trois libellés courts tiennent
        // sur un écran de 320 px, et le défilement latéral est le recours si un
        // jour ils ne tiennent plus. Rien ici ne se cache derrière un « Plus ».
        className="flex gap-1 overflow-x-auto"
      >
        {items.map((item) => (
          <LienLocataire key={item.to} item={item} />
        ))}
      </nav>

      {/* `tone="dark"` sur les trois commandes, et ce n'est pas cosmétique.
          Elles se peignent sinon dans le thème AMBIANT : en thème sombre, leur
          fond descend à la couleur du texte de la page et vient se poser sur
          une barre qui, elle, est encre en permanence. Le sélecteur de devise
          disparaissait ainsi presque entièrement — vérifié en capture, thème
          sombre, avant correction. Les trois composants portent ce ton depuis
          l'origine : il suffisait de le leur passer. */}
      <div className="mb-2.5 ml-auto flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher tone="dark" />
        {/* Même règle qu'ailleurs : le sélecteur de devise ne survit qu'en
            démonstration, faute de conversion. */}
        {/* Le repli est porté par une ENVELOPPE et non par la `className` du
            composant : celle-ci est concaténée à ses propres classes, où un
            `flex` figure déjà — deux utilitaires de `display` dans le même
            attribut, et c'est l'ordre de la feuille qui tranche, pas celui de
            la chaîne. Le sélecteur de thème restait ainsi affiché. */}
        {demo && (
          <span className="hidden sm:flex">
            <CurrencySwitcher tone="dark" />
          </span>
        )}
        {/**
         * Devise et thème se retirent sous `sm`, la langue reste.
         *
         * Les quatre commandes alignées mesurent près de 500 px : sur les
         * 390 px d'un téléphone — la cible matérielle du produit — la barre
         * passait à quatre lignes et mangeait le tiers de l'écran, en restant
         * collée. Mesuré en capture avant correction.
         *
         * Le thème est celui qui se retire le mieux : par défaut il SUIT le
         * système, qui a déjà son propre réglage sur un téléphone. La langue,
         * elle, n'a pas ce recours et reste la commande la plus demandée sur ce
         * marché.
         */}
        <span className="hidden sm:flex">
          <ThemeSwitcher tone="dark" />
        </span>
        {/* En démonstration, le sélecteur de profil est le propos : c'est par
            lui qu'on entre dans la peau du locataire, et il doit permettre d'en
            sortir. Sans lui, cette barre serait un cul-de-sac — la barre
            latérale qui le portait n'existe plus ici. */}
        {demo && <SelecteurProfilCompact role="tenant" setRole={setRole} />}
        <SelecteurParc tone="dark" />
        <MenuCompte tone="dark" />
      </div>
    </header>
  )
}

/**
 * Une destination du locataire.
 *
 * Le repère de l'entrée courante est un filet DORÉ sous le libellé, et non
 * seulement un fond : `gold-ink` tient au-delà de 3:1 sur l'encre dans les deux
 * thèmes, quand l'or de marque n'y atteint que 2,62:1. C'est le seul indice de
 * l'écran où l'on se trouve ; il doit se voir.
 */
function LienLocataire({ item }: { item: NavItem }) {
  const t = useT()
  const base = useBase()
  const label = t(item.labelKey as 'nav.dashboard')

  return (
    <NavLink
      to={lien(base, item.to)}
      end={item.to === ''}
      className={({ isActive }) =>
        cn(
          'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 sm:px-4',
          'text-label font-semibold no-underline transition-colors duration-150',
          isActive
            ? 'border-gold-ink bg-on-dark-hover text-on-dark'
            : 'border-transparent text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark',
        )
      }
    >
      {/* L'icône se retire sous `sm`, jamais le libellé. À 320 px les trois
          entrées et leurs pictogrammes ne tiennent pas : « Signaler » sortait
          du cadre et se réduisait à sa cloche, laissant deviner sa
          destination. Le dépôt tranche déjà dans ce sens pour la barre basse —
          un libellé visible, pas une icône seule. */}
      <Icon name={item.icon} size={17} className="hidden sm:block" />
      {label}
    </NavLink>
  )
}

/**
 * Le sélecteur de profil, réduit à une liste déroulante.
 *
 * Celui de la barre latérale est un groupe de boutons radio sur trois lignes —
 * il a la place, cette barre ne l'a pas. Les deux écrivent le même état ; en
 * faire deux formes est un moindre mal comparé à une barre qui ne rendrait pas
 * la main au visiteur.
 */
function SelecteurProfilCompact({
  role,
  setRole,
}: {
  role: Role
  setRole: (role: Role) => void
}) {
  const t = useT()
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('nav.activeProfile')}</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="min-h-11 cursor-pointer rounded-md border border-on-dark-border bg-on-dark-hover px-2.5 text-label text-on-dark"
      >
        {(['owner', 'manager', 'tenant'] as const).map((value) => (
          <option key={value} value={value} className="text-ink">
            {t(`roles.${value}.name` as 'roles.owner.name')}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Bandeau de démonstration.
 *
 * Sans lui, un visiteur lirait « 1 397 000 FCFA de loyers attendus » et
 * « 24 jours de retard » comme des faits. Ce sont des inventions cohérentes —
 * c'est bien leur intérêt, et c'est exactement ce qui les rend trompeuses si
 * rien ne les désigne.
 *
 * Il est posé sous la barre supérieure et non en surimpression : un bandeau
 * flottant se refermerait, ou masquerait une ligne de tableau. Celui-ci occupe
 * sa place et ne se ferme pas — la visite entière est une démonstration, pas
 * une notification.
 */
function BandeauDemo() {
  const { estDemo } = useSession()
  const t = useT()
  if (!estDemo) return null

  return (
    <div
      role="status"
      // Jetons `warn-*`, et non la palette `amber-*` de Tailwind. Ce bandeau
      // était le seul endroit du produit peint hors du système : en clair la
      // différence ne se voyait pas, en sombre il restait un rectangle crème
      // vif au-dessus d'une page noire — l'îlot clair caractéristique d'un
      // jeton oublié, ici d'une couleur qui n'était même pas un jeton. Les
      // tailles suivent l'échelle pour la même raison.
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warn-border bg-warn-tint py-2.5 text-body-s text-warn',
        GOUTTIERE_LATERALE,
      )}
    >
      <span className="eyebrow rounded-full bg-warn-border px-2 py-0.5 font-semibold tracking-wide uppercase">
        {t('common.demoBadge')}
      </span>
      {/* `basis-48` et non le `flex-1` seul qu'il y avait ici. `flex-1` vaut
          `flex: 1 1 0%` : la base nulle autorise le texte à se comprimer
          indéfiniment plutôt qu'à passer à la ligne, et à 375 px il tombait à
          un mot par ligne pendant que le bouton lui passait dessus. Une base
          de 12 rem lui donne une largeur minimale à défendre : en dessous, il
          renvoie le bouton à la ligne suivante au lieu de s'écraser. */}
      <span className="min-w-0 flex-1 basis-48 sm:basis-0">{t('common.demoNotice')}</span>
      <Button size="sm" to="/inscription/proprietaire" iconAfter="arrowRight">
        {t('common.demoCta')}
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Sidebar({
  role,
  setRole,
  railed,
  onToggleRail,
  className,
  style,
  dialogLabel,
  innerRef,
}: {
  role: Role
  setRole: (role: Role) => void
  railed: boolean
  onToggleRail: () => void
  className?: string
  style?: React.CSSProperties
  /**
   * Renseigné pour la variante tiroir. Elle assombrit la page et bloque le
   * défilement : c'est une fenêtre modale, elle doit donc le dire aux
   * technologies d'assistance et non seulement le paraître.
   */
  dialogLabel?: string
  innerRef?: Ref<HTMLElement>
}) {
  const t = useT()
  const wide = !railed
  const base = useBase()

  const { parc, nom, demo } = useIdentite()

  const pied = entreesVisibles(FOOTER_ITEMS, role, demo)

  /**
   * Le sélecteur change le point de vue de CELUI QUI REGARDE : c'est donc son
   * nom qui doit y figurer, pas celui d'un personnage. En démonstration, les
   * trois personnages restent — ils sont le propos.
   */
  const profiles: { value: Role; name: string }[] = demo
    ? [
        { value: 'owner', name: `${t('roles.owner.name')} · Arsène N.` },
        { value: 'manager', name: `${t('roles.manager.name')} · Diane F.` },
        { value: 'tenant', name: `${t('roles.tenant.name')} · Charles N.` },
      ]
    : (['owner', 'manager', 'tenant'] as const).map((value) => ({
        value,
        name: nom
          ? `${t(`roles.${value}.name` as 'roles.owner.name')} · ${nom}`
          : t(`roles.${value}.name` as 'roles.owner.name'),
      }))

  return (
    <aside
      ref={innerRef}
      // `tabIndex={-1}` sans quoi le conteneur ne peut pas recevoir le focus à
      // l'ouverture ; il reste hors du parcours de tabulation.
      tabIndex={dialogLabel ? -1 : undefined}
      role={dialogLabel ? 'dialog' : undefined}
      aria-modal={dialogLabel ? true : undefined}
      aria-label={dialogLabel}
      // `h-dvh` vaut la hauteur ENTIÈRE de l'écran depuis `viewport-fit=cover` :
      // le logo se rangeait donc sous la barre d'état, et les deux dernières
      // entrées — portail locataire, système — sous la barre de gestes.
      //
      // Haut et bas en `calc()` : le panneau est encre pleine, son fond doit
      // couvrir les zones réservées pendant que son contenu s'en écarte. À
      // gauche en `max()`, parce que la barre touche ce bord dans SES DEUX
      // variantes — rail de bureau collant, et tiroir mobile `fixed left-0`,
      // qui se rabat justement sur le côté où l'encoche mord en paysage. Le
      // bord droit ne touche rien : il garde son `pr-3`.
      //
      // Le repli est INSTANTANÉ, et c'est délibéré. Il y avait ici un
      // `transition-[width] duration-200` : `width` est une propriété de mise
      // en page, l'animer force le navigateur à recalculer la disposition à
      // chaque image — et pas seulement celle du panneau, qui est le frère
      // flex de la colonne de contenu. Seuls `transform` et `opacity` se
      // composent sans relayout.
      //
      // Les transpositions habituelles ne s'appliquent pas : la barre POUSSE
      // le contenu au lieu de le recouvrir, donc un `translateX` laisserait un
      // trou. Et surtout, regarder ce que le repli fait RÉELLEMENT retire tout
      // intérêt à l'animation — ce n'est pas une largeur qui change, c'est le
      // contenu du panneau qui est remplacé d'un bloc : logo réduit à sa
      // marque, sélecteur de profil et intitulés de section démontés, entrées
      // recentrées sans libellé ni pastille, bouton de bascule déplacé en
      // pied. Tout cela basculait à l'image zéro pendant que le cadre glissait
      // 200 ms de plus : on n'adoucissait rien, on payait un relayout complet
      // pour un décalage entre la boîte et son contenu.
      //
      // Les `transition-colors` des entrées et des profils restent : la
      // couleur est peinte, elle ne déclenche aucun calcul de disposition.
      className={cn(
        'on-dark shrink-0 flex-col gap-4 overflow-y-auto bg-ink text-on-dark',
        'sticky top-0 h-dvh',
        'pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
        'pr-3 pl-[max(0.75rem,env(safe-area-inset-left))]',
        railed ? 'w-[72px]' : 'w-64',
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-2 px-1.5">
        {wide ? (
          <Logo tone="dark" caption={parc ?? undefined} to={base} />
        ) : (
          <Logo tone="dark" markOnly to={base} />
        )}
        <IconButton
          icon="menu"
          // Dans le tiroir, ce bouton ferme ; dans la barre latérale de
          // bureau, il replie. Deux actions, deux libellés.
          label={dialogLabel ? t('nav.closeNav') : t('nav.toggleNav')}
          variant="onDark"
          onClick={onToggleRail}
          className={cn('ml-auto', railed && 'hidden')}
        />
      </div>

      {/*
        Le sélecteur est un POINT DE VUE, pas une identité — il ne change que ce
        que cette page affiche, jamais ce que le serveur accorde. Il n'a donc de
        sens que là où il y a plusieurs points de vue à montrer : la
        démonstration et ses trois personnages.

        Sur un vrai compte il proposait à l'utilisateur trois rôles portant son
        propre nom, dont deux qu'il n'a pas. Le masquer n'est possible que parce
        que le rôle vient désormais de l'adhésion : tant qu'il était fixé à
        « propriétaire » en dur, ce sélecteur était le seul moyen pour un
        gestionnaire ou un locataire d'atteindre sa propre navigation.
      */}
      {wide && demo && (
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow px-2 text-on-dark-faint">{t('nav.activeProfile')}</p>

          {/* Vrais boutons radio : la navigation par flèches et l'annonce
              « 2 sur 3 » sont natives, contrairement à des div cliquables. */}
          <fieldset className="rounded-md border-0 bg-on-dark-hover p-1">
            <legend className="sr-only">{t('nav.activeProfile')}</legend>
            {profiles.map((profile) => {
              const active = profile.value === role
              return (
                <label
                  key={profile.value}
                  className={cn(
                    'relative flex min-h-11 cursor-pointer items-center rounded-sm px-2.5 text-label',
                    'transition-colors duration-150',
                    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                    'has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-gold-on-dark',
                    active
                      ? 'bg-on-dark-active font-semibold text-on-dark shadow-[inset_2px_0_0_var(--color-gold)]'
                      : 'text-on-dark-muted hover:bg-on-dark-hover',
                  )}
                >
                  <input
                    type="radio"
                    name="active-profile"
                    value={profile.value}
                    checked={active}
                    onChange={() => setRole(profile.value)}
                    className="sr-only"
                  />
                  {profile.name}
                </label>
              )
            })}
          </fieldset>

          {/*
            Retrait de 14 px, et non 10 : c'est celui des noms de profil
            au-dessus — 4 px de `p-1` sur le `fieldset`, plus 10 px sur chaque
            étiquette. Avec 10 px, ce texte commençait quatre pixels plus à
            gauche que ceux qu'il décrit, et l'œil lisait deux colonnes là où il
            n'y en a qu'une. Un écart trop petit pour se nommer, assez grand
            pour se voir.

            Le texte fait deux lignes et touchait les deux bords : `py-2.5` lui
            rend l'air que sa hauteur de ligne réclame.
          */}
          <p className="rounded-md bg-on-dark-hover px-3.5 py-2.5 text-caps leading-relaxed text-on-dark-muted">
            {t(`roles.${role}.rights` as 'roles.owner.rights')}
          </p>
        </div>
      )}

      {/*
        UN REPÈRE DE NAVIGATION NE PORTE PAS LE NOM D'UNE DE SES DESTINATIONS.

        Ce `<nav>` en aligne douze, et s'appelait « Tableau de bord » — comme la
        première d'entre elles. Un lecteur d'écran qui liste les repères de la
        page annonçait donc « navigation, Tableau de bord », puis, dans son
        contenu, un lien « Tableau de bord » : deux choses différentes sous un
        seul nom, et rien pour dire que l'une contient l'autre.

        `nav.primaryNav` n'irait pas non plus : la vitrine le porte déjà, et
        surtout la barre basse mobile le mérite mieux — c'est elle qui porte les
        destinations principales, celle-ci les regroupe par section.
      */}
      <nav aria-label={t('nav.sectionsNav')} className="flex flex-col gap-3">
        {sectionsPour(role).map((section) => {
          const items = entreesVisibles(section.items, role, demo)
          if (!items.length) return null

          return (
            <div key={section.headingKey} className="flex flex-col gap-0.5">
              {wide && (
                <p className="eyebrow px-2.5 pb-1 text-on-dark-faint">
                  {t(section.headingKey as 'nav.sectionSteering')}
                </p>
              )}
              {items.map((item) => (
                <SidebarLink key={item.to} item={item} wide={wide} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Le filet de séparation ne se dessine que s'il sépare quelque chose :
          hors démonstration ce pied peut ne contenir que le bouton de repli, et
          n'en contenir rien du tout quand la barre est dépliée. */}
      <div
        className={cn(
          'mt-auto flex flex-col gap-0.5',
          (pied.length > 0 || railed) && 'border-t border-on-dark-border pt-3',
        )}
      >
        {pied.map((item) => (
          <SidebarLink key={item.to} item={item} wide={wide} />
        ))}
        {railed && (
          <IconButton
            icon="menu"
            label={t('nav.toggleNav')}
            variant="onDark"
            onClick={onToggleRail}
            className="mt-1 self-center"
          />
        )}
      </div>
    </aside>
  )
}

/**
 * Le parc regardé, quand il y en a plusieurs.
 *
 * N'apparaît qu'à partir de DEUX adhésions : un bailleur d'un seul parc n'a
 * rien à choisir, et un sélecteur à une entrée occupe la place d'une commande
 * utile tout en laissant croire qu'il en existe d'autres.
 *
 * Il ne convertit rien et n'additionne rien — chaque parc s'affiche dans sa
 * devise, à son tour. C'est le choix documenté dans la note de décision : la
 * vue consolidée demanderait des taux, une date de valeur et une réponse à ce
 * qu'on imprime sur une quittance. Le sélecteur, lui, ne demande rien de tout
 * cela.
 */
function SelecteurParc({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const t = useT()
  const { etat, adhesionActive, choisirParc } = useSession()
  if (etat.statut !== 'connecte' || etat.adhesions.length < 2) return null

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('nav.selectPark')}</span>
      <select
        value={adhesionActive?.parkId ?? ''}
        onChange={(e) => choisirParc(e.target.value)}
        className={cn(
          'min-h-11 cursor-pointer rounded-md border px-2.5 text-label',
          tone === 'dark'
            ? 'border-on-dark-border bg-on-dark-hover text-on-dark'
            : 'border-border bg-paper text-ink',
        )}
      >
        {etat.adhesions.map((a) => (
          // La LISTE DÉROULÉE est peinte par le système, pas par la barre : sans
          // encre explicite, ses entrées héritent du blanc du sélecteur et
          // s'écrivent alors en blanc sur le fond clair du menu natif.
          <option key={a.parkId} value={a.parkId} className="text-ink">
            {a.parkName}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Initiales du titulaire — deux lettres au plus, prises sur les mots du nom. */
function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Le compte, et la sortie.
 *
 * Un menu plutôt qu'un bouton nu : l'avatar doit d'abord dire QUI est connecté —
 * c'est la question qu'on se pose sur un poste partagé avant de se déconnecter,
 * et l'application en a déjà fait les frais (« l'auteur du produit a pris la
 * démonstration pour son espace deux fois dans la même après-midi »).
 */
function MenuCompte({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const t = useT()
  const { etat, deconnecter } = useSession()
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  /**
   * Fermeture au clic extérieur et à l'échappement, SANS voile.
   *
   * Un `fixed inset-0` transparent aurait fait l'affaire — et un garde du
   * système de design l'a refusé, à juste titre : il ne peut pas distinguer un
   * attrape-clic d'une surface peinte, et exige de toutes un rembourrage contre
   * l'encoche. Un écouteur de document n'ajoute rien à l'arbre d'accessibilité
   * et ne se pose sur aucun bord.
   */
  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false)
    }
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', echap)
    }
  }, [ouvert])

  if (etat.statut !== 'connecte') return null

  const nom = etat.compte.fullName

  return (
    <div className="relative" ref={boite}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label={t('auth.accountMenu', { name: nom })}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          // `size-11` et non `size-9` : la pastille du menu de compte faisait
          // 36 px, huit de moins que le plancher, alors qu'elle ouvre le SEUL
          // chemin vers la déconnexion et le changement de parc. Elle s'aligne
          // désormais sur l'`IconButton` qui la jouxte, qui porte 44 px depuis
          // l'origine — l'écart se voyait dans la barre sans que personne le lise.
          'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full',
          'text-label font-semibold transition-colors duration-150',
          // Encre sur encre : la pastille disparaissait purement et simplement
          // dans la barre du locataire, qui est de la même couleur. L'or est
          // celui de la maquette du portail, et `text-ink` s'y tient parce que
          // `.bg-gold` refixe `--color-ink` sur son aplat.
          //
          // Seul bouton de la coquille sans survol : `Button` et `IconButton`
          // en portent un chacun, celui-ci recopie leurs classes à la main sans
          // recopier ce dernier détail. Les jetons de survol sont ceux de leurs
          // variantes `gold` et `primary`, qui peignent déjà les mêmes fonds.
          tone === 'dark'
            ? 'bg-gold text-ink hover:bg-gold-on-dark'
            : 'bg-ink text-on-dark hover:bg-ink-2',
        )}
      >
        {initiales(nom)}
      </button>

      {ouvert && (
        <>
          <div
            role="menu"
            // Troisième site du même 50 écrit à la main, et le même remède : un
            // menu ancré à son bouton est un panneau flottant, il se nomme
            // comme les deux autres.
            style={{ zIndex: 'var(--z-popover)' }}
            className="absolute right-0 mt-2 flex w-64 flex-col gap-1 rounded-md border border-border bg-paper p-2 shadow-lg"
          >
            <div className="px-2 py-1.5">
              <p className="text-label font-semibold text-ink">{nom}</p>
              <p className="truncate text-caps text-muted">{etat.compte.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOuvert(false)
                void deconnecter()
              }}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 text-label text-ink hover:bg-surface-sunken"
            >
              <Icon name="arrowRight" size={16} />
              {t('auth.logout')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Compteurs de navigation, dérivés de l'état partagé.
 *
 * Un compteur qui ne suit pas ce qu'il compte est pire qu'absent : il annonce
 * un travail restant qui n'existe plus, et l'utilisateur qui le suit tombe sur
 * un écran vide.
 */
function useNavCount(): (key: NonNullable<NavItem['badge']>['count']) => number {
  const { units, readAlertIds, isMine, alerts: ALERTS } = usePortfolio()
  const { role } = useRole()

  return (key) => {
    if (key === 'overdue') return units.filter((u) => u.status === 'overdue').length
    const scope = role === 'tenant' ? ALERTS.filter((a) => a.unitId && isMine(a.unitId)) : ALERTS
    return scope.filter((a) => !a.read && !readAlertIds.includes(a.id)).length
  }
}

function SidebarLink({ item, wide }: { item: NavItem; wide: boolean }) {
  const t = useT()
  const label = t(item.labelKey as 'nav.dashboard')
  const count = useNavCount()
  const base = useBase()

  return (
    <NavLink
      to={lien(base, item.to)}
      // `end` sur le tableau de bord seulement : sinon il resterait actif sur
      // toutes les sous-routes. Le chemin étant relatif, la comparaison porte
      // désormais sur la chaîne vide et non sur `/app` — elle vaut donc pour
      // les deux adresses.
      end={item.to === ''}
      title={wide ? undefined : label}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-label no-underline',
          'transition-colors duration-150',
          wide ? 'justify-start' : 'justify-center',
          isActive
            ? 'bg-on-dark-active font-semibold text-on-dark shadow-[inset_2px_0_0_var(--color-gold)]'
            : 'text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark',
        )
      }
    >
      <Icon name={item.icon} size={17} />
      {wide && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {/* Une pastille à zéro disparaît : « 0 impayé » n'est pas une alerte. */}
      {wide && item.badge && count(item.badge.count) > 0 && (
        <Badge tone={item.badge.tone}>{count(item.badge.count)}</Badge>
      )}
      {!wide && <span className="sr-only">{label}</span>}
    </NavLink>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Navigation basse, sous `lg`.
 *
 * Toute la navigation mobile passait par un tiroir déclenché depuis le coin
 * HAUT GAUCHE. Sur un Android grand format tenu à une main — la cible matérielle
 * du produit — c'est le point le plus éloigné du pouce, et il fallait l'atteindre
 * pour chaque changement d'écran.
 *
 * Elle ne REMPLACE pas le tiroir, elle l'abrège : la navigation complète y reste,
 * et « Plus » l'ouvre. Le traitement clavier soigné du tiroir — `inert` sur
 * l'arrière-plan, Échap, focus rendu au déclencheur — vaut donc aussi quand on
 * part d'ici, puisque c'est le même état qui est basculé.
 */
function BarreBasse({ role, onOpenDrawer }: { role: Role; onOpenDrawer: () => void }) {
  const t = useT()
  const { demo } = useIdentite()

  // Filtrer PUIS couper, et non l'inverse : couper d'abord laisserait un trou à
  // la place de l'entrée qu'un rôle ne voit pas.
  const tous = toutesLesEntrees(role)
  // Le locataire n'a que trois entrées, toutes essentielles : l'ordre de
  // priorité ne sert qu'à choisir parmi une douzaine, et aucune des siennes n'y
  // figure. Les lui passer au crible rendrait une barre basse VIDE.
  //
  // Ses SECTIONS seulement, jamais le pied : `toutesLesEntrees` y ajoute les
  // vitrines, et en démonstration la quatrième place revenait alors à « Portail
  // locataire (web) » — une page qui montre le produit, promue au rang de
  // destination du produit. `BOTTOM_ORDER` ne les avait jamais laissées entrer.
  const candidats =
    role === 'tenant'
      ? sectionsPour(role).flatMap((s) => s.items)
      : BOTTOM_ORDER.map((to) => tous.find((item) => item.to === to)).filter(
          (item): item is NavItem => !!item,
        )
  const items = entreesVisibles(candidats, role, demo).slice(0, BOTTOM_MAX)

  return (
    <nav
      aria-label={t('nav.quickNav')}
      // `grid-flow-col auto-cols-fr` et non `grid-cols-5` : le nombre de
      // colonnes suit le nombre d'entrées survivant au filtrage par rôle, sans
      // qu'aucune arithmétique de classes n'ait à le deviner.
      //
      // Surface PEINTE et épinglée au bord physique : le bas prend donc
      // `calc(base + env(…))` — son fond doit descendre sous la barre de
      // gestes pendant que les cibles s'en écartent — quand un flotteur comme
      // le toast prend `max(base, env(…))`. Les deux côtés latéraux sont
      // traités parce qu'elle va d'un bord à l'autre : en paysage l'encoche
      // mord à gauche OU à droite selon le sens de rotation.
      //
      // Sous `var(--z-sticky)`, donc sous le voile du tiroir : quand la
      // navigation complète est ouverte, son abrégé n'a rien à faire par-dessus.
      className={cn(
        'fixed inset-x-0 bottom-0 grid grid-flow-col auto-cols-fr items-stretch lg:hidden',
        'border-t border-border bg-paper/95 backdrop-blur-md',
        'pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]',
        'pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      {items.map((item) => (
        <BottomLink key={item.to} item={item} />
      ))}

      {/*
        « Plus » est un bouton et non un lien : il n'emmène nulle part, il
        déplie la navigation restante — huit entrées que cinq cibles ne peuvent
        pas porter.
      */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className={cn(
          'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5',
          'rounded-md px-1 text-muted transition-colors duration-150',
          'hover:bg-surface-sunken hover:text-ink',
        )}
      >
        <Icon name="menu" size={19} />
        <span className="text-caps leading-tight tracking-normal">{t('nav.more')}</span>
      </button>
    </nav>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const t = useT()
  const label = t(item.labelKey as 'nav.dashboard')
  const count = useNavCount()
  const base = useBase()
  const valeur = item.badge ? count(item.badge.count) : 0

  return (
    <NavLink
      to={lien(base, item.to)}
      end={item.to === ''}
      className={({ isActive }) =>
        cn(
          // 44 px de haut minimum, et la colonne donne la largeur : c'est le
          // plancher de cible tactile, sous lequel on tape à côté.
          'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1',
          'text-center no-underline transition-colors duration-150',
          // L'entrée courante se signale TROIS fois : `aria-current` que
          // `NavLink` pose seul, un filet doré au-dessus de la cible, et la
          // graisse du libellé. La couleur seule ne se lit ni en plein soleil
          // ni pour un daltonien — et c'est précisément dehors, sur un écran
          // bon marché, que ce produit est utilisé.
          isActive
            ? 'font-semibold text-ink shadow-[inset_0_2px_0_var(--color-gold)]'
            : 'text-muted hover:bg-surface-sunken hover:text-ink',
        )
      }
    >
      {/* Icône ET libellé : une barre en icônes seules se devine, elle ne se
          lit pas — et le vocabulaire métier (« relevés », « cautions ») n'a
          aucun pictogramme évident. */}
      <span className="relative">
        <Icon name={item.icon} size={19} />
        {valeur > 0 && item.badge && (
          <Badge
            tone={item.badge.tone}
            className="absolute -top-1.5 -right-2.5 px-1 py-0 leading-tight"
          >
            {valeur}
          </Badge>
        )}
      </span>
      {/*
        Le libellé PASSE À LA LIGNE au lieu d'être coupé. Une cible fait 73 px
        à 375 px de large et le plancher typographique est de 12 px : « Tableau
        de bord » et « Parc immobilier » n'y tiennent pas sur une ligne, et
        tronquer donnait « Tableau … », « Parc im… », « Signale… » — c'est-à-
        dire une barre en icônes seules avec du bruit dessous, exactement ce
        que le libellé devait éviter. Descendre la taille était l'autre issue ;
        `plancher.test.ts` la refuse, à raison : ces écrans se lisent dehors.

        `tracking-normal` annule l'interlettrage de `text-caps`, prévu pour des
        surtitres de trois mots et qui coûte ici une lettre par ligne.
      */}
      <span className="w-full text-caps leading-tight tracking-normal text-balance">{label}</span>
    </NavLink>
  )
}

/* -------------------------------------------------------------------------- */

function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const t = useT()
  const location = useLocation()
  const base = useBase()
  const { parc, demo } = useIdentite()
  const { role } = useRole()

  // Repli sur « Écran introuvable » et non sur le tableau de bord : toute
  // adresse sans entrée de navigation rend le 404 interne, et annoncer le
  // tableau de bord dans le fil situerait l'utilisateur là où il n'est pas.
  //
  // La liste est FILTRÉE comme la navigation l'est : une adresse de vitrine
  // saisie à la main hors démonstration rend le 404, et le fil doit dire la
  // même chose que l'écran plutôt que nommer une page qui ne s'affiche pas.
  /**
   * L'entrée EXACTE, ou celle dont l'écran courant descend.
   *
   * La comparaison était une égalité stricte : le dossier d'un logement —
   * `/app/parc/<id>`, qui n'est l'adresse d'aucune entrée de navigation —
   * affichait donc « Écran introuvable » dans son fil, sur une page qui
   * s'ouvrait parfaitement. Le repli sur le 404 reste juste pour une adresse
   * inconnue ; il ne l'est pas pour un écran de détail, qui appartient bel et
   * bien à sa section.
   *
   * On retient l'entrée la plus LONGUE parmi les préfixes : sans cela, l'entrée
   * d'index — chemin vide, donc préfixe de tout — les emporterait toutes.
   */
  const visibles = entreesVisibles(toutesLesEntrees(role), role, demo)
  const crumb =
    (visibles.find((item) => lien(base, item.to) === location.pathname) ??
      visibles
        .filter((item) => item.to !== '' && location.pathname.startsWith(`${lien(base, item.to)}/`))
        .sort((a, b) => b.to.length - a.to.length)[0])?.labelKey ?? 'notFound.appTitle'

  return (
    <header
      // En-tête collant à `top-0` : avec `viewport-fit=cover`, ce zéro est le
      // bord PHYSIQUE de l'écran. Sans rembourrage, le bouton du menu et les
      // sélecteurs se rangent sous la barre d'état en portrait, et sous la
      // Dynamic Island en paysage.
      //
      // En haut, `calc()` : la barre est peinte et floutée, son fond doit
      // remonter jusqu'au bord — remplacer `py-2.5` par l'inset seul collerait
      // les commandes juste sous l'encoche. Latéralement, `max()` : le fond
      // couvre déjà toute la largeur, et l'iPhone en paysage reste sous `lg`,
      // donc cet en-tête y occupe bien toute la largeur, encoche comprise.
      className={cn(
        'sticky top-0 flex flex-wrap items-center gap-3 border-b border-border',
        'bg-paper/88 backdrop-blur-md',
        'pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5',
        'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
        'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <IconButton
        icon="menu"
        label={t('nav.openNav')}
        variant="secondary"
        onClick={onOpenDrawer}
        className="lg:hidden"
      />

      <nav aria-label={t('nav.breadcrumb')} className="hidden items-center gap-2 sm:flex">
        {/* Le fil d'Ariane annonçait « Douala » à tout le monde. Il porte
            désormais le nom du parc — et rien du tout tant qu'il n'y en a pas,
            plutôt qu'une ville inventée. */}
        {parc && (
          <>
            <span className="eyebrow text-muted">{parc}</span>
            {/* `muted-soft` et non `border-strong` : le second est un jeton de
                BORDURE employé pour un glyphe, et il tenait 1,66:1 en clair,
                2,42 en sombre — sous le seuil de 3:1 des éléments non textuels,
                donc un séparateur qu'on devine plutôt qu'on ne le voit. Le fil
                perdait sa structure.

                Pas `muted` non plus : il porte déjà le nom du parc, à gauche.
                Un séparateur aussi appuyé que ce qu'il sépare aplatit la
                hiérarchie du fil, qui compte trois degrés — parc, séparateur,
                écran courant. `muted-soft` passe à 4,33 et 5,04 en restant en
                retrait, et son propre commentaire l'autorise sur du non
                textuel : ce glyphe est `aria-hidden`. */}
            <span aria-hidden="true" className="text-muted-soft">
              /
            </span>
          </>
        )}
        <span className="eyebrow text-ink">{t(crumb as 'nav.dashboard')}</span>
      </nav>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher />
        {/*
          Le sélecteur ne survit qu'en DÉMONSTRATION, comme celui des profils.

          Le produit ne convertit pas les montants — parti pris assumé, et
          tenable tant que les sommes sont fictives. Sur un vrai parc, il n'y a
          qu'une devise juste : la sienne. Offrir d'en changer sans convertir
          n'offre pas un choix, cela ment sur l'unité — et la quittance imprimée
          en porte la trace.
        */}
        {demo && <CurrencySwitcher />}
        <ThemeSwitcher />
        {/*
          L'AVATAR ÉTAIT UN LITTÉRAL, et il n'ouvrait rien.

          « AN » — les initiales d'un personnage de la démonstration — écrites en
          dur, `aria-hidden`, sans action. `deconnecter()` existait dans la
          session, `api.logout` existait, la route serveur existait : rien ne les
          appelait. Un utilisateur ne pouvait pas se déconnecter.

          Ce n'est pas un manque d'écran mais un défaut de sécurité. Sur un poste
          partagé — le cas courant du marché visé — la session restait ouverte
          pour le suivant.

          Les initiales viennent maintenant du compte. En démonstration il n'y a
          pas de compte : le bouton n'y a rien à déconnecter, et n'apparaît pas.
        */}
        <SelecteurParc />
        <MenuCompte />
      </div>
    </header>
  )
}

/**
 * Réserve un écran à certains rôles.
 *
 * Retirer une entrée de la barre latérale ne protège rien : les routes restent
 * atteignables à la main, et `/app/parc` affichait tout le parc à un locataire.
 * Le garde s'appuie sur la même liste `roles` que la navigation, pour que les
 * deux ne puissent pas diverger.
 */
export function RoleGuard({
  allow,
  children,
  fallback,
}: {
  allow: Role[]
  children: ReactNode
  fallback: ReactNode
}) {
  const { role } = useRole()
  return <>{allow.includes(role) ? children : fallback}</>
}

