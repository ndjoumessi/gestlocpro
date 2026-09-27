import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

/**
 * LE RAIL DES LOGEMENTS D'UN IMMEUBLE — une rangée qui défile, au lieu d'une
 * grille qui s'empile.
 *
 * ═══ CE QUE LA GRILLE COÛTAIT ═══
 *
 * `auto-fill` rangeait les fiches en autant de rangées qu'il fallait : cinq
 * logements donnaient deux rangées dont la seconde à moitié vide, et un
 * immeuble de douze en donnait quatre. La carte d'immeuble grandissait donc
 * avec son parc, et l'écran devenait une colonne sans fin où l'on perdait de
 * vue l'immeuble suivant.
 *
 * UN IMMEUBLE EST UNE LIGNE. Ses logements se parcourent latéralement, sa carte
 * garde une hauteur constante quel que soit leur nombre, et deux immeubles
 * tiennent de nouveau sur un écran.
 *
 * ═══ UNE GRILLE, ET NON UN `flex` ═══
 *
 * C'est la contrainte à ne pas casser : les fiches alignent leurs cinq lignes
 * par `grid-rows-subgrid`, ce qui exige que le PARENT soit une grille dont les
 * rangées existent. Un rail en `flex` aurait rendu le défilement en une ligne
 * et détruit l'alignement — « une grille de fiches se compare par ses lignes :
 * 145 000 FCFA en face de 110 000 FCFA », et le relevé qui a produit cette
 * règle mesurait 25 px de décalage.
 *
 * `grid-flow-col` avec cinq rangées déclarées garde donc `subgrid` intact ET
 * met les fiches côte à côte : chaque fiche occupe une colonne et ses cinq
 * rangées.
 *
 * ═══ L'ACCROCHE, ET POURQUOI ELLE EST `proximity` ═══
 *
 * `snap-mandatory` force le rail à s'arrêter pile sur une fiche — confortable
 * au doigt, hostile à la molette et au clavier : une fiche plus large que la
 * fenêtre devient alors impossible à lire en entier. `proximity` accroche quand
 * on s'arrête près d'un bord et laisse tranquille sinon.
 *
 * ═══ LE CLAVIER N'A BESOIN DE RIEN DE PLUS ═══
 *
 * Chaque fiche porte un lien et un menu : la tabulation les atteint, et le
 * navigateur fait défiler le rail pour amener l'élément focalisé dans le champ.
 * On ne pose donc PAS de `tabindex` sur le conteneur — ce serait un arrêt de
 * tabulation de plus, avant les fiches elles-mêmes, pour un geste que le
 * clavier obtient déjà.
 *
 * ═══ LES DEUX FLÈCHES ═══
 *
 * Elles ne sont pas décoratives : à la souris, sans elles, il reste la barre de
 * défilement — une cible de quelques pixels — ou la molette horizontale, que
 * peu de matériels ont. Elles ne PARAISSENT que lorsque le rail déborde
 * vraiment, et chacune s'éteint quand son côté est atteint : un geste qui ne
 * mène nulle part se dit fermé plutôt que de ne rien faire.
 *
 * Elles portent `aria-hidden` : le clavier atteint déjà chaque fiche, et deux
 * boutons de défilement dans l'ordre de tabulation retarderaient le contenu
 * qu'ils prétendent servir. C'est un raccourci de POINTEUR.
 */
export function RailDeLogements({
  id,
  libelle,
  className,
  children,
}: {
  id?: string
  libelle?: string
  className?: string
  children: ReactNode
}) {
  const t = useT()
  const rail = useRef<HTMLUListElement>(null)
  const [bords, setBords] = useState({ debut: false, fin: false })

  /**
   * CE QUI DÉBORDE, ET DE QUEL CÔTÉ.
   *
   * `- 1` : les largeurs rendues ne sont pas entières, et un rail arrivé au
   * bout affiche couramment `scrollLeft = 812.67` pour un maximum de 813. Sans
   * cette tolérance, la flèche de droite reste allumée au bout du rail et
   * promet un mouvement qui n'arrive pas.
   */
  const mesurer = useCallback(() => {
    const boite = rail.current
    if (!boite) return
    const reste = boite.scrollWidth - boite.clientWidth - boite.scrollLeft
    setBords({ debut: boite.scrollLeft > 1, fin: reste > 1 })
  }, [])

  useEffect(() => {
    mesurer()
    const boite = rail.current
    if (!boite) return
    /* LA TAILLE DU RAIL CHANGE SANS QU'ON DÉFILE : une fenêtre qu'on
       redimensionne, une fiche qui gagne une ligne, la barre latérale qu'on
       replie. Sans cet observateur, les flèches gardent l'état du premier
       rendu.

       LE GARDE N'EST PAS UNE PRÉCAUTION DE STYLE. `ResizeObserver` n'existe
       pas sous jsdom : appelé sans détour, il jetait au montage et emportait
       l'écran du parc entier — 84 cas rouges, dont « aucun en-tête de page »,
       pour une flèche de défilement. Un composant ne doit pas faire disparaître
       la page qu'il décore parce qu'une interface du navigateur lui manque. */
    if (typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(boite)
    return () => observateur.disconnect()
  }, [mesurer, children])

  const glisser = (sens: -1 | 1) => {
    const boite = rail.current
    if (!boite) return
    /* D'UNE FICHE ENTIÈRE, et non d'une fraction de fenêtre : le rail accroche
       sur les bords de fiche, donc un pas qui ne serait pas un multiple de
       fiche se ferait rattraper par l'accroche — un mouvement qui revient en
       arrière tout seul. */
    const fiche = boite.querySelector<HTMLElement>('[data-fiche-logement]')
    const pas = fiche ? fiche.getBoundingClientRect().width + ECART_PX : boite.clientWidth
    boite.scrollBy({ left: sens * pas, behavior: 'smooth' })
  }

  const flecheVisible = bords.debut || bords.fin

  return (
    /*
      `min-w-0`, ET C'EST LA LIGNE QUI TIENT TOUT LE RAIL.

      La carte d'immeuble est une colonne flex ; ce conteneur en est donc un
      ÉLÉMENT, et un élément flex a `min-width: auto` — il refuse de devenir
      plus étroit que son contenu minimal. Or le contenu minimal d'une grille
      en `grid-flow-col` est la somme de ses colonnes : cinq fiches de 288 px
      font 1 488 px, et la carte, la colonne principale puis le DOCUMENT
      s'élargissaient d'autant.

      Mesuré au navigateur sur `/demo/parc` à 1 280 px : document à 1 432 px,
      soit 152 px de défilement latéral pour une page qui n'en avait aucun. Le
      `overflow-x-auto` du rail ne suffisait pas — il fait défiler ce qui
      dépasse d'une boîte dont la LARGEUR était déjà fausse.

      Le diagnostic est venu d'une bascule au navigateur, classe par classe :
      retirer `grid-flow-col` ramenait le document à 1 280, retirer l'accroche
      ne changeait rien.
    */
    <div className="relative min-w-0">
      <ul
        id={id}
        ref={rail}
        aria-label={libelle}
        onScroll={mesurer}
        data-mesure="sections-alignees"
        className={cn(
          /* CINQ RANGÉES DÉCLARÉES : ce sont celles que `subgrid` reprend. Les
             nommer ici est la condition pour que les fiches s'alignent. */
          'grid snap-x snap-proximity grid-flow-col grid-rows-[repeat(5,auto)]',
          'auto-cols-[minmax(min(100%,18rem),18rem)] gap-x-3',
          /* `overflow-x-auto` sur un conteneur qui est AUSSI la boîte de
             défilement : c'est le remède que ce dépôt impose partout à une
             largeur qui dépasse — un tableau large défile dans sa propre boîte
             au lieu de faire déborder la page. */
          /*
            `relative` SUR LA BOÎTE DE DÉFILEMENT, et c'est la moitié invisible
            du rail.

            Une boîte de défilement ne rogne que les éléments absolus dont elle
            est le BLOC CONTENEUR. Restée statique, elle laisse s'échapper tout
            `sr-only` posé dans une fiche — ils sont en `position: absolute` —
            qui va alors étendre le défilement du DOCUMENT. `DataTable` porte
            déjà cette règle et le relevé qui l'a produite : « la matrice des
            droits a fait fuir 268 px de cette façon ».

            Mesuré ici : la mention « rien à payer » d'un logement vacant,
            invisible et large de 185 px, tirait la page entière à 1 432 px pour
            une fenêtre de 1 280. Le `min-w-0` du conteneur ne suffisait pas —
            il tenait la largeur de la BOÎTE, pas ce qui s'en échappe.
          */
          'relative overflow-x-auto overscroll-x-contain',
          /* `scroll-px-4` : l'accroche tombe sur le bord de la fiche, pas sur
             le bord du rembourrage — sans quoi la première fiche s'arrête
             collée au bord de la carte. */
          'scroll-px-4 border-t border-divider px-4 pt-4 pb-1',
          className,
        )}
      >
        {children}
      </ul>

      {/*
        LE FONDU DIT « ÇA CONTINUE », la flèche dit « clique ici ».

        Sans lui, la fiche coupée par le bord se lit comme une fiche cassée, et
        la flèche posée dessus comme un bouton qui recouvre du contenu. Le
        dégradé rend la coupe VOLONTAIRE : c'est la convention de tous les rails
        du web, et la seule qui n'ajoute ni pixel ni cible.

        `from-surface` : la couleur de la carte d'immeuble, pas celle de la
        page — le rail vit DANS la carte, et un fondu vers le mauvais fond
        dessinerait une bande.

        `pointer-events-none` : il couvre des fiches cliquables, et un voile qui
        avale le clic serait pire que la coupe qu'il adoucit.
      */}
      {bords.debut && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-gradient-to-r from-surface to-transparent sm:block"
        />
      )}
      {bords.fin && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-gradient-to-l from-surface to-transparent sm:block"
        />
      )}

      {flecheVisible && (
        <>
          <FlecheDuRail
            sens="debut"
            actif={bords.debut}
            libelle={t('app.portfolio.railPrevious')}
            onClick={() => glisser(-1)}
          />
          <FlecheDuRail
            sens="fin"
            actif={bords.fin}
            libelle={t('app.portfolio.railNext')}
            onClick={() => glisser(1)}
          />
        </>
      )}
    </div>
  )
}

/** L'écart entre deux fiches, en pixels — `gap-x-3`, tenu ici pour le pas. */
const ECART_PX = 12

/**
 * Une flèche de rail.
 *
 * ÉTEINTE PLUTÔT QU'ABSENTE au bout du rail : une flèche qui disparaît déplace
 * sa voisine, et la cible sous le doigt change d'identité entre deux gestes.
 *
 * `bg-paper` plein et non un voile : elle se pose SUR les fiches, et une cible
 * translucide au-dessus d'un chiffre le rend illisible tout en paraissant
 * cliquable à moitié.
 */
function FlecheDuRail({
  sens,
  actif,
  libelle,
  onClick,
}: {
  sens: 'debut' | 'fin'
  actif: boolean
  libelle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      disabled={!actif}
      aria-label={libelle}
      onClick={onClick}
      className={cn(
        /* 44 px, LE PLANCHER DU DÉPÔT. Écrites d'abord en `size-9`, elles ont
           été refusées par la sonde des cibles — « 36 × 37, vu à /demo/parc » —
           et elle a raison : `aria-hidden` retire une cible de l'ARBRE
           D'ACCESSIBILITÉ, pas du chemin du doigt. */
        'absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center sm:inline-flex',
        'rounded-full border border-border bg-paper text-ink shadow-e1',
        'transition-opacity duration-150',
        actif ? 'cursor-pointer opacity-100 hover:border-ink' : 'cursor-default opacity-0',
        sens === 'debut' ? 'left-1' : 'right-1',
      )}
    >
      <Icon name={sens === 'debut' ? 'chevronLeft' : 'chevronRight'} size={16} />
    </button>
  )
}
