import { useContext, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { FermerLeMenu } from './fermetureDuMenu'

/**
 * LES ENTRÉES D'UN MENU — ce qu'on y choisit, et rien du panneau qui les porte.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * `MenuDeDebordement.tsx` tenait quatre composants et 833 lignes, pour un
 * plafond de 800 que `plafond-de-lignes` garde. Le franchissement avait été
 * inscrit avec son motif, et ce motif annonçait ce lot-ci.
 *
 * LA COUTURE N'EST PAS « SOUS 800 COÛTE QUE COÛTE », que cette porte refuse
 * explicitement de commander. Elle est de NATURE : le panneau est une SURFACE
 * — ancrage, renversement, altitude, piège de focus, animation de sortie —
 * tandis que ces trois-ci sont des CHOIX — un geste, un axe, un trait. Les
 * deux moitiés ne changent pas pour les mêmes raisons : la première bouge
 * quand le rognage ou l'empilement bougent, la seconde quand un écran a besoin
 * d'une nouvelle forme d'entrée.
 *
 * `MenuDeDebordement` LES RÉEXPORTE PAR LEUR NOM, et aucun des dix appelants
 * n'a changé d'import. C'est la règle que ce dépôt s'est donnée après coup :
 * un découpage qui oblige à recâbler ses appelants rougit sur l'oubli, pas sur
 * le découpage. Le lien ESM garde la barrique gratuitement.
 */

/** Une entrée de menu. Elle referme le panneau en même temps qu'elle agit. */
/**
 * UN TRAIT ENTRE DEUX NATURES DE GESTE.
 *
 * Le menu d'une fiche portait quatre entrées de trois natures — modifier,
 * ranger, détruire — au même poids visuel. La seule irréversible n'était
 * séparée de rien.
 *
 * `role="separator"` EST LÉGITIME DANS UN `menu` : l'en-tête de ce fichier dit
 * qu'un menu « n'admet que des `menuitem` parmi ses descendants SIGNIFIANTS »,
 * et ARIA admet précisément le séparateur à côté d'eux. Il ne compte pas dans
 * le « 2 sur 3 » annoncé, ce qui est exactement ce qu'on veut : il sépare, il
 * ne se choisit pas.
 *
 * `my-1` et non une marge plus large : ce qu'on veut est une COUPURE, pas une
 * respiration. Un trait qui flotte se lit comme un vide et le menu paraît
 * inachevé.
 */
export function MenuSeparateur() {
  return <div role="separator" className="my-1 h-px bg-divider" />
}

/**
 * UN AXE, DEUX SENS, UNE SEULE RANGÉE.
 *
 * ═══ CE QUE DEUX RANGÉES COÛTAIENT ═══
 *
 * « Déplacer à gauche » et « Déplacer à droite » occupaient deux entrées de
 * menu. C'est un contrôle, pas deux décisions : l'axe s'y lisait comme deux
 * choix étrangers l'un à l'autre, et le menu doublait de hauteur pour le dire.
 * Le chevron y était en outre redondant — « à gauche » nomme déjà la direction
 * que le glyphe répétait.
 *
 * ═══ DEUX `menuitem` DANS UNE RANGÉE, ET LA RÈGLE TIENT ═══
 *
 * La `div` qui les aligne ne porte aucun rôle : elle n'est pas un descendant
 * SIGNIFIANT, et les deux seuls descendants signifiants restent des `menuitem`.
 * Le décompte annoncé par la synthèse vocale reste juste, et les deux cibles
 * restent deux alternatives à un seul pointeur — ce qu'exige WCAG 2.5.7 de tout
 * geste obtenu par glissement.
 *
 * `size-11` — 44 px — sur chaque flèche : ce sont des cibles au doigt comme les
 * autres, et le dépôt en a une garde.
 *
 * FERMÉE PLUTÔT QUE RETIRÉE aux extrémités, pour la raison que `MenuElement`
 * écrit déjà à propos de ses entrées closes : un geste qui disparaît fait
 * chercher ce qu'on a mal fait. Et `aria-disabled` plutôt que `disabled`, même
 * motif — l'état s'annonce et la cible reste atteignable au clavier.
 */
export function MenuAxe({
  libelle,
  gauche,
  droite,
}: {
  libelle: string
  gauche: { nomAccessible: string; onClick?: () => void }
  droite: { nomAccessible: string; onClick?: () => void }
}) {
  /* `FermerLeMenu` N'EST PLUS CONSOMMÉ ICI — voir le `onClick` plus bas : un axe
     est un réglage répété, il ne referme pas le panneau qui le porte. */
  const sens = (nom: 'chevronLeft' | 'chevronRight', c: { nomAccessible: string; onClick?: () => void }) => {
    const ferme = c.onClick === undefined
    return (
      <button
        type="button"
        role="menuitem"
        aria-label={c.nomAccessible}
        aria-disabled={ferme || undefined}
        /*
          ═══ L'AXE NE REFERME PAS LE PANNEAU, ET C'EST LA DIFFÉRENCE AVEC UNE
              ENTRÉE ═══

          Il appelait `fermer()` avant d'agir, comme `MenuElement`. La raison
          d'être de `MenuElement` ne s'applique pas ici : ses entrées sont des
          DÉCISIONS — corriger, retirer — dont une seule se prend à la fois, et le
          panneau qui se ferme est la confirmation qu'elle est partie. Un axe est
          un RÉGLAGE RÉPÉTÉ.

          CE QUE ÇA COÛTAIT : déplacer une fiche de quatre rangs demandait quatre
          cycles ouvrir-naviguer-activer, le panneau clignotant à chaque pas, et
          — avant la région vivante du rail — sans le moindre retour entre deux.
          Le contrôle se fermait lui-même après chaque usage.

          RIEN NE MANQUE POUR EN SORTIR : le panneau se ferme par Échap, par clic
          extérieur et au défilement, et `usePiegeDeFocus` tient les trois.

          ET LES DEUX FLÈCHES SE TIENNENT À JOUR PENDANT QU'IL EST OUVERT :
          `peutAller` lit l'ordre AFFICHÉ, recalculé à chaque rendu, donc la
          flèche se ferme bien quand la fiche atteint le bout — sans quoi on
          pousserait dans le vide sur un panneau qui ne se referme plus.
        */
        onClick={ferme ? undefined : () => c.onClick?.()}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-lg',
          'transition-colors duration-150',
          /* LE SEGMENT SE SOULÈVE sur le creux du rail : `--color-surface` est
             au-DESSUS de `--color-paper` dans les DEUX thèmes (#ffffff sur
             #f6f9fc, #0f1d32 sur #0a1628), donc le survol est un relief et
             survit au retournement. Pas `bg-surface-sunken` : c'est le rail.
             `shadow-e1`, le barreau nommé le plus bas, et non le `shadow-sm` de
             Tailwind : le dépôt ne connaît que e1/e2/e3, et une ombre écrite
             hors barreau ne suit pas le thème sombre, où les trois passent au
             noir pur pour rester visibles sur un fond presque noir. */
          ferme
            ? 'cursor-not-allowed text-muted opacity-45'
            : 'cursor-pointer text-ink hover:bg-surface hover:shadow-e1',
        )}
      >
        {/* PAS D'`opacity-70` comme les icônes de `MenuElement`, qui
            ACCOMPAGNENT un libellé quand celle-ci EST le geste. Les deux
            opacités se multipliaient sur la flèche fermée — 0,45 × 0,70, soit
            31 % de l'encre sourde, ~1,35:1 : WCAG 1.4.3 exempte les contrôles
            inactifs, donc aucune porte ne la voyait manquer. */}
        <Icon name={nom} size={16} />
      </button>
    )
  }
  return (
    /* `px-3` COMME LES ENTRÉES PLEINES : `pr-1` calait de l'air contre de
       l'air tant que les cibles étaient invisibles. Le rail, lui, est un BORD,
       et il tombait à 8 px de la paroi quand « Corriger » commence à 16. */
    /* `role="group"` AVEC SON NOM : ARIA admet un groupe parmi les enfants d'un
       `menu`, et c'est ce que cette rangée est — un ensemble nommé de deux
       entrées liées. Le nom n'est pas décoratif : sans lui, un lecteur d'écran
       annoncerait deux flèches sans dire de quoi elles sont les deux sens, et
       `menusLicites` refuse d'ailleurs un groupe anonyme. */
    <div role="group" aria-label={libelle} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3">
      {/*
        UNE CALE, PAS UNE ICÔNE, ET C'EST UN CHOIX.

        Relevé sur la capture : sans elle, « Déplacer » commençait dans la
        COLONNE DES ICÔNES quand « Corriger » et « Retirer » commençaient 26 px
        plus loin — trois libellés à trois abscisses dans un menu de quatre
        lignes. Les mêmes `gap-2.5` et la même largeur de 16 px que l'icône de
        `MenuElement` remettent la colonne d'aplomb.

        AUCUNE ICÔNE DU JEU NE VEUT DIRE « DÉPLACER » — ni `layers`, ni
        `arrowRight`, ni `sliders`, qui sert déjà « Corriger ». En emprunter une
        dirait quelque chose de faux à la place de ne rien dire, et le dépôt
        refuse ailleurs exactement cet emprunt : « un jeton que le code
        contourne n'est pas un jeton ». Les deux flèches, à droite, portent déjà
        le sens du geste.
      */}
      <span aria-hidden="true" className="w-4 shrink-0" />
      <span className="flex-1 text-body text-ink">{libelle}</span>
      {/*
        ═══ UN RAIL CREUSÉ, ET LES DEUX SENS DEDANS ═══

        Les flèches n'avaient ni cadre ni fond jusqu'au survol : deux glyphes de
        16 px dans deux carrés invisibles de 44. Sur la capture, « Déplacer » se
        lisait comme un libellé suivi de deux signes de PONCTUATION — seule
        commande du panneau dont la cible ne se voit pas. Et un contrôle qui
        attend le survol n'existe pas au doigt, où il n'y a pas de survol.

        UN RAIL PLUTÔT QU'UN CADRE PAR FLÈCHE, deuxième écriture : encadrer
        chacune, mesuré sur `/demo/parc`, rendait la paire bancale — A1 ne peut
        pas reculer, donc une carte blanche à droite et un chevron fantôme à
        gauche, deux natures pour un seul axe. Le rail est UN objet, entier même
        quand un sens est fermé — ce que la fermeture-plutôt-que-retrait dit
        déjà plus haut. PAS D'`overflow-hidden` dessus : l'anneau de focus est
        un `outline` à `outline-offset: 2px` (`tokens.css`), qu'un ancêtre qui
        rogne couperait sur les bords extérieurs. Segments bord à bord, sans
        rembourrage — la rangée garde ses 44 px, comme ses voisines.
      */}
      <span className="flex shrink-0 items-center rounded-lg bg-surface-sunken">
        {sens('chevronLeft', gauche)}
        {sens('chevronRight', droite)}
      </span>
    </div>
  )
}

export function MenuElement({
  icone,
  onClick,
  nomAccessible,
  raison,
  ton,
  children,
}: {
  icone?: Parameters<typeof Icon>[0]['name']
  /**
   * ABSENT, L'ENTRÉE EST FERMÉE — et elle reste LÀ.
   *
   * Une entrée retirée du menu ne s'explique pas : on cherche la commande
   * manquante, puis ce qu'on a mal fait. Présente et fermée, son nom accessible
   * porte le motif. C'est la règle que le Parc applique déjà à ses deux
   * suppressions, transposée dans le menu.
   *
   * `aria-disabled` et non `disabled` : un élément désactivé sort de l'ordre de
   * tabulation, donc sa raison devient inatteignable au clavier — pour qui en a
   * le plus besoin. Il reste atteignable, annonce son état, et n'agit pas.
   */
  onClick?: () => void
  /**
   * Le nom que la synthèse vocale annonce, quand le libellé VISIBLE ne suffit
   * pas à désigner la cible.
   *
   * « Corriger » se répète par ligne : douze entrées identiques ne disent pas
   * laquelle on active. Le libellé visible reste court — il vit dans un menu
   * déjà ouvert sur SA ligne — et le nom accessible porte le numéro.
   */
  nomAccessible?: string
  /**
   * POURQUOI le geste est fermé — rendu SOUS le libellé, et non seulement dans
   * le nom accessible.
   *
   * Un geste éteint sans motif est un cul-de-sac : on clique, rien ne se
   * passe, et on recommence. La raison existait déjà dans ce produit — « le
   * logement a une histoire dans le parc » — mais elle ne vivait que dans
   * `aria-label`, c'est-à-dire pour la synthèse vocale et pour personne
   * d'autre. Le voyant, lui, n'avait qu'une ligne grise.
   */
  raison?: string
  /**
   * `danger` peint le geste qui DÉTRUIT — au survol et au focus seulement.
   *
   * Pas au repos : un menu dont une entrée est rouge en permanence fait lire le
   * rouge avant le mot, et la liste entière se met à crier. C'est au moment où
   * le doigt s'y pose que la couleur a quelque chose à dire.
   */
  ton?: 'danger'
  children: ReactNode
}) {
  const fermer = useContext(FermerLeMenu)
  const ferme = onClick === undefined
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={nomAccessible}
      aria-disabled={ferme || undefined}
      onClick={
        ferme
          ? undefined
          : () => {
              fermer()
              onClick()
            }
      }
      className={cn(
        'flex min-h-11 w-full gap-2.5 rounded-md px-3 py-1.5',
        /* LE GLYPHE SE CALE EN HAUT quand une raison suit le libellé : centré
           sur deux lignes, il se retrouve en face du motif plutôt qu'en face du
           geste qu'il désigne. */
        ferme && raison ? 'items-start pt-2.5' : 'items-center',
        'text-left text-body transition-colors duration-150',
        ferme
          ? /*
              UN GESTE FERMÉ QUI S'EXPLIQUE DOIT SE LIRE.

              `opacity-45` est l'éteint que `Button` applique à ses commandes
              fermées, et il convient tant qu'il n'y a rien à lire dessous. Une
              RAISON à 45 % serait une phrase qu'on tend sans la rendre
              lisible ; le motif du refus est justement ce qui distingue « pas
              maintenant » de « cassé ».

              Sans raison, l'éteint d'avant ne bouge pas.
            */
            cn('cursor-not-allowed', raison ? 'text-muted' : 'text-muted opacity-45')
          : cn(
              'cursor-pointer text-ink',
              ton === 'danger'
                ? 'hover:bg-danger-tint hover:text-danger focus-visible:bg-danger-tint'
                : 'hover:bg-surface-sunken',
            ),
      )}
    >
      {icone && (
        <Icon
          name={icone}
          size={16}
          className={cn('shrink-0', ferme ? 'text-muted' : 'text-inherit opacity-70')}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{children}</span>
        {/* LA RAISON SOUS LE LIBELLÉ : elle qualifie le geste, pas plus.

            ═══ ELLE ÉTAIT ÉCRITE `text-caption`, QUI N'EXISTE PAS ═══

            Aucun `--text-caption` dans `tokens.css`, donc Tailwind v4 n'émet
            AUCUNE règle : la chaîne est absente de `dist/assets/*.css`. La
            raison héritait du bouton, soit `text-body` — 14 px MESURÉ sur
            `/demo/parc` en 1280 —, la taille exacte du geste qu'elle qualifie,
            dans la même encre, le bouton entier étant `text-muted` dès qu'il
            porte une raison. Elle prenait trois lignes et l'entrée 81 px, soit
            40 % d'un panneau dont les deux gestes DISPONIBLES tiennent sur une
            ligne chacun : le menu parlait surtout de ce qu'on ne peut pas faire.

            `text-label` est le plancher typographique (12 px), et il est
            déclaré. La taille porte SEULE la hiérarchie : l'encre reste celle du
            bouton, une raison plus pâle que le geste éteint étant une phrase
            qu'on tend sans la rendre lisible — ce que `ferme` refuse déjà.
            (Vingt-neuf autres emplois de `text-caption` sont morts pareillement
            et portent `text-muted` à côté, donc hors de ce menu.) */}
        {ferme && raison && <span className="mt-0.5 text-label text-pretty">{raison}</span>}
      </span>
    </button>
  )
}
