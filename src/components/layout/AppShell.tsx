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
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'
import { LienEvitement } from './LienEvitement'
import { CadreContext } from './PageHeader'
import { Logo } from '@/components/primitives/Logo'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { Button, IconButton } from '@/components/primitives/Button'
import { usePiegeDeFocus } from '@/components/primitives/piegeDeFocus'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS } from '@/currency/currencies'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import type { CurrencyCode } from '@/currency/currencies'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'
import { useT } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { lien, useBase } from '@/lib/base'
import { CadreDuParc } from '@/components/feedback/CadreDuParc'


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
  /* `accent` remplace `onDark` : la pastille des signalements non lus n'est
     pas une alerte — un signalement se lit, il ne se règle pas en retard — mais
     elle doit se voir. Elle prenait un ton nommé d'après le DÉCOR qui
     l'entourait, une barre sombre ; la barre est claire, et le ton dit
     désormais ce qu'il peint. */
  badge?: { count: 'overdue' | 'unreadAlerts'; tone: 'danger' | 'accent' }
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
        badge: { count: 'unreadAlerts', tone: 'accent' },
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
  const { setDeviseSource } = useCurrency()

  /**
   * LA DEVISE DU PARC EST DÉCLARÉE, ELLE NE FORCE PLUS L'AFFICHAGE.
   *
   * `CurrencyProvider` ne lisait que `localStorage` : la devise du parc, portée
   * par l'adhésion depuis toujours, n'était lue nulle part. Un parc camerounais
   * s'affichait donc dans la dernière devise choisie sur cette machine — et une
   * QUITTANCE imprimait « 50,00 € » pour 50 000 FCFA.
   *
   * Le remède d'alors était d'IMPOSER la devise du parc, faute de conversion.
   * Elle existe désormais — parité légale pour le franc CFA, cours de la BCE
   * pour les deux dollars — et cette devise redevient ce qu'elle est vraiment :
   * celle des DONNÉES, le point de départ de toute conversion. Ce qu'on affiche
   * peut en différer, et c'est le sujet du sélecteur.
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
    if (deviseDuParc) setDeviseSource(deviseDuParc)
  }, [deviseDuParc, setDeviseSource])
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
            <CadreDuParc />
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
            <CadreDuParc />
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
      /* Marqueur de mesure : c'est le TÉMOIN de la surface « barre du
         locataire » de `mesure-ui`. Cette coquille n'existe qu'une fois le
         profil basculé, donc jamais pendant un balayage ordinaire — la
         démonstration démarre en propriétaire. Sans témoin, un geste qui
         cesserait de basculer laisserait la porte auditer la coquille du
         BAILLEUR en croyant mesurer celle du locataire. */
      data-mesure="barre-locataire"
      /**
       * CE COMMENTAIRE DÉCRIVAIT UN PIÈGE QUI N'EXISTE PLUS ICI, et il vaut
       * d'être gardé pour ce qu'il enseigne.
       *
       * Il expliquait pourquoi les libellés portaient `text-on-dark` EN TOUTES
       * LETTRES sous un conteneur `.on-dark` : le remappage de cette classe est
       * écrit `:not([class*='bg-'])`, donc il se RETIRE de lui-même dès qu'un
       * élément porte son propre fond — ce qui était le cas de l'entrée
       * courante et du survol. S'y fier rendait le libellé actif invisible,
       * encre sur encre.
       *
       * La barre n'est plus sombre, la classe est partie, et le piège avec.
       * La règle qu'il énonce, elle, reste vraie partout où `.on-dark` survit :
       * un remappage conditionné par l'absence de fond ne couvre pas ce qui en
       * pose un.
       *
       * Collante et peinte jusqu'au bord physique : avec `viewport-fit=cover`,
       * `top-0` est le haut de l'écran, et sans le `calc()` le logo se range
       * sous la barre d'état. Latéralement `max()`, la barre allant d'un bord à
       * l'autre — en paysage l'encoche mord d'un côté ou de l'autre.
       */
      className={cn(
        /*
          LA BARRE DU LOCATAIRE SUIT LA COQUILLE, et `on-dark` s'en va aussi.

          DEUX DÉFAUTS DISPARAISSENT AVEC LA CLASSE, et c'est la raison de les
          traiter ici plutôt que un par un. `.on-dark` remappe `.text-ink`,
          `.text-muted` et `.text-accent-ink` vers l'encre inversée FIGÉE, et ce
          remappage gagnait sur deux endroits qui croyaient être en fond clair :
          les `<option>` du sélecteur natif, peintes en blanc sur le fond clair
          du menu système, et le panneau du menu de compte, qui pose `bg-paper`
          — un jeton qui BASCULE — sous des encres figées en blanc. Les deux
          étaient invisibles en thème clair. Retirer la classe les rend au
          contexte qu'elles supposaient depuis le début.

          `border-b` pour la même raison que le `border-r` de la barre latérale :
          une barre blanche sur un papier presque blanc n'a plus de limite.
        */
        'sticky top-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface',
        'pt-[calc(0.625rem+env(safe-area-inset-top))]',
        'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
        'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <Logo to={base} size="sm" className="mr-4 mb-2.5" />

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

      {/* LE TON SOMBRE EST RETIRÉ DES TROIS COMMANDES, et le défaut qu'il
          corrigeait s'est retourné exactement.

          Il existait parce que la barre était encre EN PERMANENCE tandis que
          ces commandes se peignaient dans le thème AMBIANT : en thème sombre
          leur fond descendait à la couleur du texte de la page et disparaissait
          sur l'encre. La barre suivant désormais le thème comme elles, le ton
          forcé produit le défaut INVERSE — et il l'a produit : mesuré sur la
          barre devenue blanche, « FR » rendait rgba(255,255,255,0.68) sur du
          blanc et le sélecteur de devise du blanc plein sur un voile blanc à
          7 %. Deux commandes purement et simplement invisibles.

          Je les avais oubliées en éclaircissant la barre ; c'est la capture,
          pas la porte, qui me les a montrées. La leçon est celle que ce lot
          répète : un ton FORCÉ est un pari sur le fond, et il se perd le jour
          où le fond change de camp. */}
      <div className="mb-2.5 ml-auto flex flex-wrap items-center justify-end gap-2">
        <LanguageSwitcher />
        {/* LE SÉLECTEUR N'EST PLUS RÉSERVÉ À LA DÉMONSTRATION. Il l'était
            « faute de conversion » : changer de devise ne faisait que
            ré-étiqueter des montants, et les quatre devises affichaient les
            mêmes chiffres. Elles se convertissent maintenant. */}
        {/* Le repli est porté par une ENVELOPPE et non par la `className` du
            composant : celle-ci est concaténée à ses propres classes, où un
            `flex` figure déjà — deux utilitaires de `display` dans le même
            attribut, et c'est l'ordre de la feuille qui tranche, pas celui de
            la chaîne. Le sélecteur de thème restait ainsi affiché. */}
        <span className="hidden sm:flex">
          <CurrencySwitcher />
        </span>
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
          <ThemeSwitcher />
        </span>
        {/* En démonstration, le sélecteur de profil est le propos : c'est par
            lui qu'on entre dans la peau du locataire, et il doit permettre d'en
            sortir. Sans lui, cette barre serait un cul-de-sac — la barre
            latérale qui le portait n'existe plus ici. */}
        {demo && <SelecteurProfilCompact role="tenant" setRole={setRole} />}
        <SelecteurParc />
        <MenuCompte />
      </div>
    </header>
  )
}

/**
 * Une destination du locataire.
 *
 * Le repère de l'entrée courante est un filet DORÉ sous le libellé, et non
 * seulement un fond : `accent-ink` tient au-delà de 3:1 sur l'encre dans les deux
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
            /* Le filet passe de `accent-on-dark` à `accent` : sur une barre
               blanche, le bleu clair des panneaux figés ne rend que 1,95 — sous
               les 3:1 d'un repère qui est le SEUL indice de l'écran courant.
               `--color-accent` en tient 5,17, et l'onglet reprend le couple
               lavis + encre d'accent de la barre latérale, pour que les deux
               coquilles du produit désignent l'actif de la même façon. */
            ? 'border-accent bg-accent-tint text-accent-ink'
            : 'border-transparent text-muted hover:bg-surface-sunken hover:text-ink',
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
        className="min-h-11 cursor-pointer rounded-md border border-border bg-surface px-2.5 text-label text-ink"
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
      /*
        UNE MENTION, ET NON PLUS UNE BANDE — mesuré, et c'est le plus gros poste
        de la coquille.

        Repliée (`flex-wrap`), la phrase complète tombait sur quatre lignes à
        360 px : 140 px de bandeau, répétés sur les 23 écrans, au-dessus d'un
        en-tête qui en pesait déjà 185. Sur les 325 px que la coquille prenait
        avant le premier mot, ce bandeau en portait 43 %.

        `flex-nowrap` et une phrase COURTE sous `sm`. Ce n'est pas une
        troncature : `demoNoticeShort` est une phrase entière, vraie, qui dit la
        même chose — « données fictives, rien n'est enregistré ». Couper la
        longue aurait menti par omission, et c'est le téléphone, appareil du
        marché visé, qui aurait reçu le mensonge.
      */
      className={cn(
        'flex flex-nowrap items-center gap-x-3 border-b border-warn-border bg-warn-tint py-1.5 text-body text-warn',
        GOUTTIERE_LATERALE,
      )}
    >
      {/* La pastille se retire sous `sm`, et c'est mesuré : à 320 px, pastille
          (100 px) + bouton (153 px) + gouttières débordaient de 4 px — le seul
          débordement latéral des 23 écrans après ce lot, relevé par
          `mesure-ui`. Elle est aussi la plus redondante des trois pièces :
          la phrase courte dit déjà « données fictives », donc la retirer ne
          retire aucune information, seulement sa répétition en capitales. */}
      <span className="eyebrow hidden shrink-0 rounded-full bg-warn-border px-2 py-0.5 font-semibold tracking-wide uppercase sm:inline">
        {t('common.demoBadge')}
      </span>
      {/* Les deux formulations sont RENDUES toutes les deux et l'une est
          masquée par requête média, jamais par mesure de la fenêtre en JS : une
          bascule au montage produirait un décalage de mise en page au premier
          rendu, ce que la porte compte. */}
      {/* LE POINT DE BASCULE EST `lg`, ET IL EST MESURÉ. À `sm` (640 px), la
          phrase longue était rognée jusqu'à 900 px inclus — donc la moitié des
          largeurs recevait la version tronquée, celle-là même qu'on refusait au
          téléphone. Relevé sur les onze largeurs, dans les deux langues : la
          longue ne tient qu'à partir de 1280 — à 1024 la barre latérale reprend
          256 px et la rogne encore —, la courte tient dès 320. */}
      {/* AUCUNE DES DEUX NE SE COUPE, et la longue vient de perdre son
          `truncate`.

          Elle nomme ce qui est fictif : couper « Immeubles, locataires et
          mon… » rendrait la phrase pauvre qu'elle vient remplacer. La courte
          l'avait compris depuis le début et passe à la ligne quand il le faut —
          mesuré à deux lignes sous 700 px, une au-delà.

          LA LONGUE GARDAIT LE SIEN « comme une ceinture pour une langue future
          plus bavarde ». La ceinture a serré, et pas sur une langue : à 22 px de
          police racine — le cran « très grand » d'Android —, la phrase manque
          375 px à 1280 et s'affiche « Vous parcourez une démonstration : ces
          imm… ». Une ceinture qui coupe la phrase qu'elle protège n'en est pas
          une. Elle se replie donc, comme sa jumelle. */}
      <span className="min-w-0 flex-1 xl:hidden">{t('common.demoNoticeShort')}</span>
      <span className="hidden min-w-0 flex-1 xl:block">{t('common.demoNotice')}</span>
      <Button size="sm" to="/inscription/proprietaire" iconAfter="arrowRight" className="shrink-0">
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
        /*
          LA BARRE LATÉRALE PASSE AU CLAIR, et `on-dark` s'en va avec le fond.

          Ce n'est pas un repeint : retirer `on-dark` DÉFIGE `--color-ink`,
          `--color-ink-2` et toute la famille `--color-on-dark*`, et désactive
          du même coup les quatre règles de remappage de `tokens.css` ainsi que
          `.on-dark *:focus-visible`. L'anneau de focus retombe sur
          `--color-accent-ink`, ce qui est le comportement voulu sur fond clair.
          Chaque jeton posé plus bas devait donc être rejugé un par un — c'est
          fait, et aucune valeur n'a été inventée.

          `border-r` EST NÉCESSAIRE, et c'est le piège de l'opération : ce
          panneau ne se séparait du contenu que par sa COULEUR. Devenu blanc sur
          un papier presque blanc, il n'aurait plus eu de limite du tout.
        */
        'shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface text-ink',
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
          <Logo caption={parc ?? undefined} to={base} />
        ) : (
          <Logo markOnly to={base} />
        )}
        <IconButton
          icon="menu"
          // Dans le tiroir, ce bouton ferme ; dans la barre latérale de
          // bureau, il replie. Deux actions, deux libellés.
          label={dialogLabel ? t('nav.closeNav') : t('nav.toggleNav')}
          variant="secondary"
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
          <p className="eyebrow px-2 text-muted">{t('nav.activeProfile')}</p>

          {/* Vrais boutons radio : la navigation par flèches et l'annonce
              « 2 sur 3 » sont natives, contrairement à des div cliquables. */}
          <fieldset className="rounded-md border-0 bg-surface-sunken p-1">
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
                    'has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent-ink',
                    active
                      ? 'bg-accent-tint font-semibold text-accent-ink shadow-[inset_2px_0_0_var(--color-accent)]'
                      : 'text-muted hover:bg-surface-sunken',
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
          {/*
            UNE MENTION RATTACHÉE AU RÔLE ACTIF, ET NON UN QUATRIÈME RÔLE.

            Ce texte portait le MÊME fond que les trois étiquettes de profil
            au-dessus (`bg-on-dark-hover`), la même largeur, le même arrondi, et
            se posait juste sous elles. Vérifié dans la source : ce n'est pas un
            bouton, pas un lien, rien ne l'écoute — et pourtant il avait tout
            l'appareil visuel d'une quatrième option qu'on n'arrivait pas à
            cliquer. Le fond disparaît : reste une légende, en retrait, qui
            décrit le profil retenu.

            `aria-live` : le texte change quand on change de profil, sans que
            rien d'autre bouge à l'écran. Un lecteur d'écran qui vient de
            cocher « Gestionnaire » entend ce que ce rôle donne, au lieu de
            devoir revenir le chercher.
          */}
          <p
            aria-live="polite"
            className="px-3.5 text-caps leading-relaxed text-muted"
          >
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
                <p className="eyebrow px-2.5 pb-1 text-muted">
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
          (pied.length > 0 || railed) && 'border-t border-border pt-3',
        )}
      >
        {pied.map((item) => (
          <SidebarLink key={item.to} item={item} wide={wide} />
        ))}
        {railed && (
          <IconButton
            icon="menu"
            label={t('nav.toggleNav')}
            variant="secondary"
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
/* Plus de `tone` : ce sélecteur ne vivait sur fond sombre que dans la barre du
   locataire, qui est passée au clair. Une branche sans appelant ne se garde pas
   « au cas où » — elle se rend invisible au premier lecteur, et le jour où on la
   rallume personne ne sait plus si elle a jamais été juste. */
function SelecteurParc() {
  const t = useT()
  const { etat, adhesionActive, choisirParc } = useSession()
  if (etat.statut !== 'connecte' || etat.adhesions.length < 2) return null

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('nav.selectPark')}</span>
      <select
        value={adhesionActive?.parkId ?? ''}
        onChange={(e) => choisirParc(e.target.value)}
        className="min-h-11 cursor-pointer rounded-md border border-border bg-paper px-2.5 text-label text-ink"
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
/**
 * LE POINT D'ENTRÉE UNIQUE DES RÉGLAGES — langue, devise, thème.
 *
 * LE DÉFAUT. Les trois segmentés vivaient à demeure dans la moitié droite de la
 * barre, sur les 23 écrans. Mesuré à 360 px : l'en-tête repliait ses commandes
 * sur trois lignes et faisait 185 px de haut, sur les 325 px que la coquille
 * mangeait avant le premier mot de contenu — près d'un tiers d'un téléphone,
 * pour des choix qu'on fait une fois puis plus jamais.
 *
 * CE QUI NE DISPARAÎT PAS. Aucun réglage n'est retiré ni caché derrière une
 * seconde porte : le panneau montre les TROIS d'un coup, chacun sous son
 * intitulé visible, chacun atteignable au doigt, à la souris et au clavier.
 * Un geste ouvre, le suivant choisit — c'est un geste de plus qu'avant pour un
 * réglage annuel, contre 120 px de hauteur rendus à chaque écran.
 *
 * Le motif de fermeture est celui de `MenuCompte`, volontairement : écouteurs
 * de document plutôt qu'un voile `fixed inset-0`, qu'un garde du système de
 * design refuse parce qu'il ne peut pas distinguer un attrape-clic d'une
 * surface peinte.
 *
 * `role="dialog"` et non `menu` : un menu contient des `menuitem`, or ce
 * panneau contient trois groupes de boutons à état. Promettre `menu` à un
 * lecteur d'écran promettrait aussi la navigation aux flèches, qui ne mène
 * nulle part ici — le dépôt tranche déjà dans ce sens pour la barre du
 * locataire.
 */
/* Pas de `tone` : ce menu ne vit que dans la barre claire. La barre du
   locataire garde ses trois segmentés — elle n'a pas de barre latérale, donc
   pas le même budget de hauteur, et son relevé la donne à 71 px. */
/**
 * CE QUE LA CONVERSION A FAIT, OU N'A PAS PU FAIRE.
 *
 * ═══ QUAND ELLE A EU LIEU ═══
 *
 * Un montant converti n'est pas le montant enregistré : c'est une lecture, à un
 * cours, un jour donné. Le taire laisserait croire que le parc est tenu dans la
 * devise affichée — et le chiffre changerait demain sans que rien ne l'explique.
 *
 * ═══ QUAND ELLE N'A PAS PU ═══
 *
 * C'est le cas qui manquait, et il est plus grave que l'autre. Sans cours, la
 * devise demandée est inatteignable : le choix était enregistré, l'écran restait
 * dans la monnaie du parc, et RIEN ne l'expliquait. On choisissait le dollar
 * canadien et il ne se passait rien — un contrôle qui a l'air cassé, ce qui est
 * pire qu'un contrôle absent.
 *
 * Le produit ne peut pas convertir sans cours et ne doit pas inventer ; la seule
 * chose qui lui reste est de DIRE ce qu'il affiche à la place.
 *
 * Sur un parc lu dans sa propre devise, il n'y a ni conversion ni manque : la
 * mention se tait, et l'annoncer serait du bruit.
 */
function MentionDeConversion() {
  const t = useT()
  const d = useDates()
  const { converti, coursIndisponibles, dateDesCours, deviseSource } = useCurrency()

  if (coursIndisponibles)
    return (
      <span className="text-caps text-warn">
        {t('common.currencyUnavailable', { currency: CURRENCY_DEFS[deviseSource].label })}
      </span>
    )

  if (!converti) return null

  /*
    UNE CONVERSION SANS DATE EST UNE PARITÉ, ET ELLE SE DIT AINSI.

    La parité du franc CFA est fixée par traité : elle n'a pas de jour de
    publication, et annoncer une date qu'on n'a pas serait le seul mensonge
    possible ici. Mais se taire n'est pas mieux — l'écran affiche alors des euros
    sur un parc tenu en francs sans dire d'où vient le nombre.

    LE TEST EST SÛR parce que les deux moitiés ne se mélangent pas : les cours
    flottants n'arrivent JAMAIS sans leur date (voir `taux.ts`, où l'absence de
    date fait tomber la réponse entière). Une conversion sans date n'a donc pu
    passer que par la parité.
  */
  if (!dateDesCours) return <span className="text-caps text-muted">{t('common.currencyPegged')}</span>

  return (
    <span className="text-caps text-muted">
      {t('common.currencyConverted', { date: d.fullDate(partiesDeDateISO(dateDesCours)) })}
    </span>
  )
}

function MenuReglages() {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  /*
    LE MÊME PIÈGE QUE LA MODALE, ET IL MANQUAIT.

    Ce panneau n'avait qu'un écouteur d'Échap et un clic extérieur. Mesuré au
    navigateur : quatre tabulations sur dix sortaient du panneau OUVERT, et à la
    fermeture le focus restait où il avait erré — sur un bouton de légende de
    graphique, à l'autre bout de la page. Trois commandes de la coquille, sur
    les 23 écrans, derrière une porte sans poignée au clavier.

    `focusInitial: 'premier'` et non le repli de la modale : tout le contenu de
    ce panneau EST des boutons, donc « le premier non-bouton » n'existe pas et
    ferait retomber le focus sur le conteneur. Le premier segment de langue est
    la bonne première étape.

    `verrouillerLeDefilement: false` : un panneau ancré à son bouton n'arrête
    pas la page derrière lui. Une modale le fait ; celui-ci n'en est pas une.
  */
  usePiegeDeFocus(ouvert, boite, () => setOuvert(false), {
    fermerAuClicExterieur: true,
    focusInitial: 'premier',
  })

  return (
    <div className="relative" ref={boite}>
      <IconButton
        /* `sliders` : l'icône de réglages du jeu, `settings` n'existe pas. */
        icon="sliders"
        label={t('nav.settingsOpen')}
        variant="secondary"
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert((o) => !o)}
      />

      {ouvert && (
        <div
          role="dialog"
          aria-label={t('nav.settings')}
          style={{ zIndex: 'var(--z-popover)' }}
          className="absolute right-0 mt-2 flex w-64 flex-col gap-4 rounded-md border border-border bg-paper p-4 shadow-lg"
        >
          <div className="flex flex-col gap-2">
            <span className="text-caps text-muted uppercase">{t('common.language')}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caps text-muted uppercase">{t('common.currency')}</span>
            <CurrencySwitcher />
            <MentionDeConversion />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caps text-muted uppercase">{t('common.theme')}</span>
            <ThemeSwitcher />
          </div>
        </div>
      )}
    </div>
  )
}

/* Plus de `tone`, pour la même raison que `SelecteurParc` : son seul appelant
   sur fond sombre était la barre du locataire. */
function MenuCompte() {
  const t = useT()
  const { etat, deconnecter } = useSession()
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  /*
    MÊME PIÈGE QUE LE PANNEAU DES RÉGLAGES ET QUE LA MODALE.

    Ce menu portait le même motif incomplet — Échap et clic extérieur, rien
    d'autre — et il n'a jamais eu de cas de test clavier. Il ouvre pourtant le
    SEUL chemin vers la déconnexion : sur un poste partagé, cas courant du
    marché visé, un focus qui s'échappe laisse la session ouverte au suivant.

    `focusInitial: 'premier'` : son contenu est un pavé d'identité non
    focalisable puis un bouton de déconnexion. Le premier focalisable est donc
    ce bouton, et c'est la bonne première étape.
  */
  usePiegeDeFocus(ouvert, boite, () => setOuvert(false), {
    fermerAuClicExterieur: true,
    focusInitial: 'premier',
  })

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
          // `.bg-accent` refixe `--color-ink` sur son aplat.
          //
          // Seul bouton de la coquille sans survol : `Button` et `IconButton`
          // en portent un chacun, celui-ci recopie leurs classes à la main sans
          // recopier ce dernier détail. Les jetons de survol sont ceux de la
          // variante `primary`, qui peint déjà le même fond.
          'bg-ink text-on-dark hover:bg-ink-2',
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
              {/* Une adresse électronique n'a pas de longueur maximale : la
                  couper dans un menu de 256 px est le seul comportement tenable. */}
              <p data-donnee className="truncate text-caps text-muted">
                {etat.compte.email}
              </p>
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
            /* L'ACTIF PORTE DU TEXTE D'ACCENT, et non plus l'encre ordinaire.
               Sur fond sombre, l'entrée courante se distinguait par un lavis
               blanc à 14 % — la seule chose qui se voie sur du presque-noir. Sur
               fond clair, le lavis d'accent et l'encre d'accent vont ensemble :
               6,12 mesuré, et l'œil retrouve l'écran courant à la couleur avant
               de lire le mot. Le filet de 2 px reste : trois signaux valent
               mieux qu'un lavis seul pour qui distingue mal le bleu, et il
               reprend `--color-accent`, qui tient 5,17 sur ce lavis. */
            ? 'bg-accent-tint font-semibold text-accent-ink shadow-[inset_2px_0_0_var(--color-accent)]'
            : 'text-muted hover:bg-surface-sunken hover:text-ink',
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
        // `gap-1` : les cinq cibles se touchaient bord à bord — 70 px de large,
        // zéro pixel entre elles. WCAG 2.5.8 compte l'ESPACEMENT dans la
        // taille effective d'une cible, et deux cibles jointives se valident
        // au pixel près tout en produisant la faute qu'elles prétendent
        // éviter : le doigt qui déborde de « Paiements » atterrit dans
        // « Travaux » sans jamais rater le vide. Quatre pixels ramènent chaque
        // cible de 70 à 66 px de large — vingt-deux au-dessus du plancher —
        // et créent une frontière où le doigt peut se tromper sans conséquence.
        'fixed inset-x-0 bottom-0 grid grid-flow-col auto-cols-fr items-stretch gap-1 lg:hidden',
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
            ? 'font-semibold text-ink shadow-[inset_0_2px_0_var(--color-accent)]'
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

        ── LE REPLI NE SUFFISAIT PAS, ET LA MESURE L'A DIT ──────────────────

        Le repli coupe entre les MOTS. Quand le libellé n'en a qu'un et qu'il
        est plus large que sa colonne, il n'y a rien à couper : le mot sortait
        de sa cellule et se peignait par-dessus la voisine. Mesuré à 320 px :
        « Signalements » demande 76 px dans 51, et chevauche « Parc immobilier ».
        L'anglais n'en réchappe pas — « Dashboard » et « Payments » débordent
        aussi. Cinq colonnes de 51 px ne portent aucun libellé de ce métier.

        Aucune autre règle ne le voyait : la page ne défile pas pour autant, et
        c'est `MESURER_DEBORD_LOCAL` — écrit pour cet angle mort — qui l'a
        nommé.

        `hyphens-auto` D'ABORD, `break-words` ENSUITE, et l'ordre compte. La
        césure coupe où la langue l'autorise et pose un trait d'union —
        « Signale- / ments » —, ce qui se lit. Elle a besoin de la langue du
        document, que `I18nProvider` écrit sur `<html lang>` à chaque bascule.
        `break-words` est le filet : quand la césure ne s'applique pas — langue
        sans dictionnaire, navigateur qui ne la fait pas —, le mot casse sans
        trait d'union plutôt que de déborder. Un mot cassé se lit mal ; deux
        libellés superposés ne se lisent pas du tout.
      */}
      <span
        /* Marqueur de mesure : `mesure-ui` vérifie qu'aucun de ces libellés ne
           laisse un ORPHELIN de moins de trois caractères en fin de coupure.
           Sans lui, la porte ne saurait pas les distinguer du reste du texte —
           un débordement se voit, une mauvaise coupure non. */
        data-mesure="libelle-barre-basse"
        className="w-full text-caps leading-tight tracking-normal hyphens-auto text-balance break-words"
      >
        {label}
      </span>
    </NavLink>
  )
}

/* -------------------------------------------------------------------------- */

function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const t = useT()
  const { parc } = useIdentite()

  /* Le calcul du fil d'Ariane est parti avec lui, et avec lui trois lectures
     de contexte — l'adresse courante, la base, le rôle. Il déduisait de la
     liste des entrées de navigation le nom de l'écran, avec un repli sur
     « Écran introuvable ». Le `<h1>` de chaque page porte ce nom depuis
     toujours ; le déduire une seconde fois était la source de la redite. */

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

      {/*
        LE FIL D'ARIANE SE FOND DANS L'EN-TÊTE DE PAGE.

        Il annonçait « PARC DE DÉMONSTRATION / TABLEAU DE BORD » pendant que le
        `<h1>` de la page, quinze pixels plus bas, disait « Tableau de bord ».
        Deux fois le même mot, dont l'un dans un repère de navigation que les
        lecteurs d'écran listent à part : le fil promettait un chemin là où il
        n'y a qu'un niveau — aucune des 23 adresses n'a de parent cliquable
        autre que l'écran courant.

        CE QUI RESTE EST LE CONTEXTE, ET NON LE LIEU. Le nom du parc dit sur
        QUOI l'on travaille, ce que le titre de page ne dit jamais ; il n'est
        donc pas un doublon et il reste. Ce n'est plus une navigation : plus de
        repère, plus de séparateur, plus de nom d'écran.

        CE QUE CE GESTE NE RAPPORTE PAS, et il faut le dire : ZÉRO PIXEL de
        hauteur. Le fil était déjà masqué sous `sm`, donc invisible sur
        l'appareil du marché visé, et à 1280 la hauteur de la barre est fixée
        par ses boutons de 44 px, pas par lui — mesuré à 65 px avant comme
        après. Ce qu'il rend est de la largeur, et une redite en moins.
      */}
      {parc && <span className="hidden eyebrow text-muted sm:inline">{parc}</span>}

      {/* UNE SEULE LIGNE, ET C'EST LA MESURE QUI L'EXIGE. `flex-nowrap` remplace
          `flex-wrap` : avec trois segmentés dépliés, la barre se repliait sur
          trois lignes à 360 px et pesait 185 px. Derrière un bouton unique,
          les commandes tiennent sur une ligne à toutes les largeurs. */}
      <div className="ml-auto flex flex-nowrap items-center justify-end gap-2">
        {/*
          Langue, devise et thème sont derrière `MenuReglages`. Aucun ne
          disparaît — voir l'en-tête du composant pour ce que ce geste coûte et
          ce qu'il rend. Le sélecteur de devise ne survit qu'en DÉMONSTRATION,
          comme celui des profils : le produit ne convertit pas les montants —
          parti pris assumé, tenable tant que les sommes sont fictives. Sur un
          vrai parc, il n'y a qu'une devise juste : la sienne. Offrir d'en
          changer sans convertir n'offre pas un choix, cela ment sur l'unité —
          et la quittance imprimée en porte la trace.
        */}
        <MenuReglages />
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

