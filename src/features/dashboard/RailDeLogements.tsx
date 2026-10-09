import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { indexCible, ordreReconcilie } from './ordreDuRail'
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
/**
 * L'ALTERNATIVE À UN SEUL POINTEUR, ET CE N'EST PAS UN CONFORT.
 *
 * WCAG 2.5.7 : toute fonction obtenue par un geste de GLISSEMENT doit avoir une
 * alternative qui tienne en un seul pointeur. Déplacer une fiche en est une. Le
 * menu de chaque fiche porte donc « Déplacer à gauche » / « à droite », ce qui
 * sert du même coup le clavier — qui atteint déjà ce menu.
 *
 * PAR CONTEXTE, parce que l'ordre vit dans le rail et le menu chez l'appelant :
 * remonter l'état jusqu'à l'écran du parc ferait payer à tout le monde ce qui ne
 * regarde qu'une rangée. Hors d'un rail, le crochet rend `null` et l'appelant
 * n'affiche rien — c'est le cas des fiches montées seules dans un test.
 */
const DeplacementDeFiche = createContext<{
  /* `libelle` NE SERT QU'À L'ANNONCE, et c'est pour cela qu'il traverse le
     contexte plutôt que d'être déduit ici : le rail réordonne ses enfants par
     leurs CLÉS et ne sait pas ce qu'est un logement — c'est la ligne que
     l'en-tête de ce fichier dit tenir. Nommer la fiche déplacée demande le seul
     renseignement qu'il n'a pas, et l'appelant l'a déjà sous la main. */
  deplacer: (cle: string, sens: -1 | 1, libelle: string) => void
  peutAller: (cle: string, sens: -1 | 1) => boolean
} | null>(null)

export function useDeplacementDeFiche() {
  return useContext(DeplacementDeFiche)
}

export function RailDeLogements({
  id,
  libelle,
  className,
  children,
  queue,
}: {
  id?: string
  libelle?: string
  className?: string
  children: ReactNode
  /**
   * UNE TUILE DE FIN, QUI N'EST PAS UNE FICHE.
   *
   * Elle sort APRÈS les fiches, dans le `<ul>` et donc dans la grille — c'est
   * la condition pour qu'elle occupe une colonne du rail plutôt qu'une rangée
   * sous lui. Elle ne passe PAS par `children`, et la distinction porte tout ce
   * lot : tout ce qui entre par `children` est une fiche, donc une clé de
   * `clesServies`, donc quelque chose que l'ordre réconcilie, que le menu
   * déplace et que le glissement permute. Une tuile « ajouter » prise pour une
   * fiche se laisserait réordonner et compterait dans « 3 sur 4 ».
   *
   * Elle n'a pas non plus `data-fiche-logement` : c'est par cet attribut que le
   * glissement relève les centres des colonnes, et un centre de plus déplacerait
   * les fiches vers une case qui n'en est pas une.
   */
  queue?: ReactNode
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

  /**
   * ═══ LES FICHES SE RÉORDONNENT, ET RIEN N'EN EST RETENU ═══
   *
   * On attrape une fiche, on la déplace parmi les autres, elles se décalent pour
   * montrer où elle atterrira. Au rechargement, le parc retrouve son ordre :
   * c'est un geste d'INSPECTION — mettre deux logements côte à côte pour les
   * comparer — pas un réglage. Aucun champ ne le porterait de toute façon,
   * `Unit` n'ayant ni `order` ni `position`.
   *
   * L'ORDRE VIT ICI, PAS CHEZ L'APPELANT. Le rail réordonne ses `children` par
   * leurs CLÉS : il n'a pas besoin de savoir ce qu'est un logement, et l'écran du
   * parc n'a pas une ligne à changer. `ordreReconcilie` remet cette liste
   * d'accord avec le parc servi à chaque rendu — voir `ordreDuRail.ts`.
   *
   * LA FICHE NE SUIT PAS LE CURSEUR, et c'est un écart au design annoncé qu'il
   * faut dire. Pour qu'elle colle au curseur pendant que les autres se décalent,
   * il faudrait ré-ancrer sa transformation à chaque permutation — et une
   * transformation sur une fiche est précisément ce que `grid-rows-subgrid`
   * supporte mal, la contrainte que le docbloc de ce fichier dit « à ne pas
   * casser ». Ce qui est rendu à la place : la fiche prise s'allège, et l'ORDRE
   * bouge en direct sous le curseur. Le mouvement montre le résultat au lieu de
   * montrer la main.
   */
  const [ordre, setOrdre] = useState<string[]>([])
  /**
   * ═══ RÉORDONNER NE S'ANNONÇAIT PAS — WCAG 4.1.3 ═══
   *
   * Le geste par le menu ne déplace PAS le focus : il reste sur le déclencheur,
   * qui voyage avec la fiche. Rien n'annonçait donc le rang atteint, et qui ne
   * voit pas le rail activait « Déplacer à gauche » sans le moindre retour — ni
   * position, ni confirmation. La seule chose qui changeait pour lui était la
   * flèche qui finissait par se fermer en bout de rangée.
   *
   * C'est le précédent du sélecteur de mois, à la lettre : « changer de mois ne
   * déplace pas le focus — il reste sur la flèche — donc rien n'annoncerait le
   * mois atteint » (`Portfolio.tsx`).
   *
   * ELLE EST MONTÉE EN PERMANENCE ET REMPLIE ENSUITE. Une région vivante montée
   * EN MÊME TEMPS que son contenu n'annonce rien — ce dépôt l'écrit déjà à trois
   * endroits, et c'est la faute qui rendrait cette garde creuse.
   *
   * CE QU'ELLE NE COUVRE PAS, ET IL FAUT LE DIRE : le glissement à la souris
   * permute aussi l'ordre, sans annonce. Deux raisons de s'en tenir là — il est
   * borné au pointeur `mouse`, donc à qui voit la rangée bouger sous son
   * curseur ; et annoncer chaque permutation pendant un glissement rendrait un
   * torrent, là où 4.1.3 demande un message, pas un flux.
   */
  const [annonce, setAnnonce] = useState('')
  const deplacement = useRef<{ cle: string; x: number; aGlisse: boolean } | null>(null)
  const [cleDeplacee, setCleDeplacee] = useState<string | null>(null)

  const enfants = Children.toArray(children).filter(isValidElement)
  /* `Children.toArray` PRÉFIXE LES CLÉS — `A1` devient `.$A1`. Le préfixe sert
     à React pour distinguer les enfants d'un tableau de ceux d'un autre ; il ne
     doit pas fuir hors d'ici. L'appelant connaît ses fiches par leur identifiant
     (`unit.id`), et c'est par lui que le menu demande un déplacement. Mesuré en
     l'oubliant : le glissement marchait — il déduit la clé de la POSITION dans
     le DOM — et le menu ne faisait rien, son `indexOf` rendant -1 en silence. */
  const cleDe = (enfant: { key: string | null }) => String(enfant.key).replace(/^\.\$/, '')
  const clesServies = enfants.map(cleDe)
  const clesAffichees = ordreReconcilie(ordre, clesServies)
  const parCle = new Map(enfants.map((enfant) => [cleDe(enfant), enfant]))

  /**
   * ═══ LE RAIL SE SAISIT, ET SEULEMENT À LA SOURIS ═══
   *
   * Le docbloc de ce fichier dit déjà pourquoi les deux flèches existent : « à
   * la souris, sans elles, il reste la barre de défilement — une cible de
   * quelques pixels — ou la molette horizontale, que peu de matériels ont ». Les
   * flèches avancent d'une fiche à la fois ; attraper la rangée et la pousser
   * est le geste que la souris n'avait pas.
   *
   * `pointerType === 'mouse'` EST TOUTE LA CONCEPTION, pas une restriction.
   * Écouter le doigt mettrait ce geste en concurrence avec le défilement natif
   * du rail — qui fonctionne déjà, qu'aucun seuil ne peut égaler, et dont le
   * conflit se paierait sur l'Android d'entrée de gamme que ce produit vise.
   * Borné à la souris, il n'y a plus deux prétendants au même geste.
   *
   * PAS D'INERTIE, DÉLIBÉRÉMENT. La règle du mouvement voudrait de l'élan avec
   * amortissement ; ici on pilote le `scrollLeft` natif d'un conteneur en
   * `snap-proximity`, et une boucle d'inertie se battrait contre l'accroche du
   * navigateur — un rail qui glisse puis se fait rattraper en arrière. Le
   * panoramique s'arrête au relâchement et laisse le CSS accrocher.
   */
  const saisie = useRef<{ x: number; depart: number; aGlisse: boolean } | null>(null)
  /** Un glissement vient de finir : le clic qui le suit ne doit pas partir. */
  const glissementFini = useRef(false)
  const [saisi, setSaisi] = useState(false)

  const auPointeurEnfonce = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const boite = rail.current
    if (!boite) return
    /* LE PANORAMIQUE SE REPLIE SUR LE FOND DU RAIL. Les deux gestes commencent
       par le même appui : pousser la rangée et déplacer une fiche ne peuvent pas
       se disputer le même pixel. La fiche prend l'appui qui la concerne, le fond
       garde le reste — l'espace entre les fiches et les marges. Le curseur reste
       `grab` partout, ce qui est juste : tout se saisit ici, seul l'effet
       diffère. */
    if ((e.target as Element).closest('[data-fiche-logement]')) return
    /* Un appui neuf annule la mémoire du précédent : sans cela, un glissement
       terminé hors du rail — donc sans clic derrière — laisserait le drapeau
       levé et mangerait le clic SUIVANT, qui n'a rien demandé. */
    glissementFini.current = false
    saisie.current = { x: e.clientX, depart: boite.scrollLeft, aGlisse: false }
    setSaisi(true)
    /*
      ═══ ON NE CAPTURE PAS ICI, ET C'EST UN DÉFAUT MESURÉ AU NAVIGATEUR ═══

      Premier jet : `setPointerCapture` dès l'appui. Les quatre cas jsdom
      passaient, et le lien d'une fiche NE NAVIGUAIT PLUS — relevé à la main sur
      `/demo/parc`, page fraîche, sans aucun glissement avant : clic sur « A1 »,
      l'adresse ne bougeait pas.

      LA RAISON EST DANS LA SPEC, pas dans ce code : tant qu'un pointeur est
      capturé, le `click` est dispatché sur l'ÉLÉMENT CAPTEUR et non sur la cible
      du survol. L'ancre ne recevait donc jamais son clic — ce n'était même pas
      ma suppression qui l'avalait, c'était la capture qui le détournait.

      ET LA GARDE NE POUVAIT PAS LE VOIR : jsdom ne fournit pas
      `setPointerCapture`, donc le garde-fou `typeof === 'function'` sautait
      l'appel et le cas mesurait un monde sans capture. L'angle mort était
      exactement l'API absente. Un cinquième cas le ferme autrement — il vérifie
      qu'on ne capture PAS à l'appui, ce qui est structurel et donc mesurable
      sans navigateur.

      La capture se prend donc au franchissement du seuil (voir plus bas), là où
      elle sert : garder le glissement quand le curseur sort du rail. À ce
      moment-là, le clic qui suivra est de toute façon destiné à être supprimé.
    */
  }

  const auPointeurDeplace = (e: React.PointerEvent<HTMLUListElement>) => {
    const prise = saisie.current
    const boite = rail.current
    if (!prise || !boite) return
    const dx = e.clientX - prise.x
    /* LE SEUIL EST LA MOITIÉ DU LOT. Chaque fiche porte un lien vers son
       logement et un menu : sans lui, attraper le rail navigue. Sous quatre
       pixels, rien ne s'est passé — et quatre parce qu'une main qui clique n'est
       jamais parfaitement immobile. */
    if (!prise.aGlisse && Math.abs(dx) < SEUIL_DE_GLISSEMENT_PX) return
    if (!prise.aGlisse) {
      prise.aGlisse = true
      /* LA CAPTURE SE PREND ICI, au franchissement — voir le docbloc de l'appui
         pour ce qu'elle coûtait posée plus tôt. Gardée par `typeof` comme
         `ResizeObserver` l'est vingt lignes plus haut : jsdom ne la fournit pas,
         et un composant ne doit pas faire disparaître la page qu'il décore
         parce qu'une interface du navigateur lui manque. */
      if (typeof boite.setPointerCapture === 'function') boite.setPointerCapture(e.pointerId)
    }
    boite.scrollLeft = prise.depart - dx
  }

  const auPointeurRelache = (e: React.PointerEvent<HTMLUListElement>) => {
    const prise = saisie.current
    if (!prise) return
    saisie.current = null
    setSaisi(false)
    glissementFini.current = prise.aGlisse
    const boite = rail.current
    if (boite && typeof boite.releasePointerCapture === 'function') {
      try {
        boite.releasePointerCapture(e.pointerId)
      } catch {
        /* la capture a déjà été rendue — relâcher deux fois n'est pas une faute */
      }
    }
  }

  const auPointeurEnfonceSurFiche = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const fiche = (e.target as Element).closest<HTMLElement>('[data-fiche-logement]')
    if (!fiche) return
    const index = Array.from(
      rail.current?.querySelectorAll<HTMLElement>('[data-fiche-logement]') ?? [],
    ).indexOf(fiche)
    const cle = clesAffichees[index]
    if (cle === undefined) return
    glissementFini.current = false
    deplacement.current = { cle, x: e.clientX, aGlisse: false }
  }

  const auPointeurDeplaceSurFiche = (e: React.PointerEvent<HTMLUListElement>) => {
    const prise = deplacement.current
    const boite = rail.current
    if (!prise || !boite) return
    if (!prise.aGlisse && Math.abs(e.clientX - prise.x) < SEUIL_DE_GLISSEMENT_PX) return
    if (!prise.aGlisse) {
      prise.aGlisse = true
      setCleDeplacee(prise.cle)
      if (typeof boite.setPointerCapture === 'function') boite.setPointerCapture(e.pointerId)
    }
    /* LES CENTRES SE RELISENT À CHAQUE IMAGE, et il le faut : ils viennent de
       changer, puisque le mouvement précédent a permuté des fiches. Un relevé
       pris à l'appui décrirait une rangée qui n'existe plus. */
    const centres = Array.from(
      boite.querySelectorAll<HTMLElement>('[data-fiche-logement]'),
    ).map((li) => {
      const r = li.getBoundingClientRect()
      return r.left + r.width / 2
    })
    retenirLeDefilement()
    setOrdre((precedent) => {
      const actuel = ordreReconcilie(precedent, clesServies)
      const depuis = actuel.indexOf(prise.cle)
      const vers = indexCible(centres, e.clientX)
      if (depuis === -1 || depuis === vers) return actuel
      const suivant = [...actuel]
      suivant.splice(vers, 0, ...suivant.splice(depuis, 1))
      return suivant
    })
  }

  const auPointeurRelacheSurFiche = () => {
    const prise = deplacement.current
    if (!prise) return
    deplacement.current = null
    setCleDeplacee(null)
    /* Un déplacement franc mange le clic qui le suit : sans cela, ranger une
       fiche ouvrirait le logement qu'on vient de déposer. */
    if (prise.aGlisse) glissementFini.current = true
  }

  /**
   * LE CLIC EST PRIS EN CAPTURE, ET NON EN REMONTÉE.
   *
   * `onClick` sur ce conteneur se déclencherait APRÈS celui de la fiche : le
   * lien aurait navigué, le menu se serait ouvert. `preventDefault` seul ne
   * suffit pas non plus — il arrête la navigation d'une ancre, pas l'exécution
   * d'un `onClick` de bouton. En capture, le clic est intercepté avant
   * d'atteindre la fiche, et les deux sont arrêtés ensemble.
   */
  const auClicEnCapture = (e: React.MouseEvent<HTMLUListElement>) => {
    if (!glissementFini.current) return
    glissementFini.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const glisser = (sens: -1 | 1) => {
    const boite = rail.current
    if (!boite) return
    /* D'UNE FICHE ENTIÈRE, et non d'une fraction de fenêtre : le rail accroche
       sur les bords de fiche, donc un pas qui ne serait pas un multiple de
       fiche se ferait rattraper par l'accroche — un mouvement qui revient en
       arrière tout seul. */
    const fiche = boite.querySelector<HTMLElement>('[data-fiche-logement]')
    const pas = fiche ? fiche.getBoundingClientRect().width + ECART_PX : boite.clientWidth
    /*
      ═══ `'smooth'` BATTAIT LA RÈGLE GLOBALE, ET C'EST DANS LA SPEC ═══

      `tokens.css` pose `scroll-behavior: auto !important` sous
      `prefers-reduced-motion: reduce`, et cette déclaration ne pouvait RIEN ici :
      CSSOM-View ne consulte le `scroll-behavior` calculé que si l'appel passe
      `'auto'` ou ne dit rien. Un `behavior: 'smooth'` explicite fait défiler en
      douceur quoi qu'en dise la feuille de style — un `!important` ne gouverne
      que les déclarations concurrentes, pas un argument de fonction.

      C'était donc le SEUL mouvement du produit qui ignorait la préférence, et il
      échappait à la règle globale par le seul chemin qu'elle ne couvre pas. Les
      deux autres appels de défilement du dépôt — `scrollIntoView` dans
      `Combobox` et `SignUp` — ne passent pas de `behavior` et obéissent bien au
      CSS.

      `typeof matchMedia` GARDÉ comme `ResizeObserver` et `setPointerCapture`
      vingt lignes plus haut, et pour la même raison : jsdom ne le fournit pas, et
      une flèche de défilement ne doit pas faire disparaître l'écran du parc.
    */
    const mouvementReduit =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    boite.scrollBy({ left: sens * pas, behavior: mouvementReduit ? 'auto' : 'smooth' })
  }

  const flecheVisible = bords.debut || bords.fin

  /**
   * ═══ LE RAIL SAUTAIT D'UNE FICHE À CHAQUE DÉPLACEMENT ═══
   *
   * Mesuré au navigateur : réordonner faisait passer `scrollLeft` de 0 à 300 —
   * exactement une fiche — et le relevé a été pris DEPUIS LE MENU, donc sans le
   * moindre geste de glissement. Ce n'était pas le geste.
   *
   * DEUX DIAGNOSTICS, UN SEUL JUSTE. J'ai d'abord coupé l'ancrage de défilement
   * (`overflow-anchor: none`) : appliqué — vérifié `none` dans le style calculé
   * — et sans effet, le saut restant à 300. Ce n'est pas l'ancrage.
   *
   * C'est le RE-CALAGE de `scroll-snap`. Un conteneur accroché se re-cale sur le
   * MÊME élément quand le contenu change, et l'élément calé — la fiche qu'on
   * vient de déplacer — a changé de place à la demande de l'utilisateur. Le
   * navigateur poursuit donc la fiche, et défait le geste en le servant.
   *
   * On rétablit le défilement après la permutation, en phase de mise en page
   * pour qu'aucune image ne montre le saut. Ce qui est préservé est la POSITION
   * DE LA RANGÉE, ce que l'œil tient pour fixe pendant qu'on range une fiche.
   */
  const defilementARetablir = useRef<number | null>(null)

  useLayoutEffect(() => {
    const cible = defilementARetablir.current
    if (cible === null) return
    defilementARetablir.current = null
    const boite = rail.current
    if (boite) boite.scrollLeft = cible
  }, [ordre])

  const retenirLeDefilement = () => {
    const boite = rail.current
    if (boite) defilementARetablir.current = boite.scrollLeft
  }

  const deplacerParLeMenu = (cle: string, sens: -1 | 1, libelle: string) => {
    retenirLeDefilement()
    setOrdre((precedent) => {
      const actuel = ordreReconcilie(precedent, clesServies)
      const depuis = actuel.indexOf(cle)
      const vers = depuis + sens
      if (depuis === -1 || vers < 0 || vers >= actuel.length) return actuel
      const suivant = [...actuel]
      suivant.splice(vers, 0, ...suivant.splice(depuis, 1))
      /* L'ANNONCE EST POSÉE ICI, dans le calcul qui connaît le rang atteint, et
         pas au retour de l'appel : `vers` est déjà borné par la garde du dessus,
         donc ce qu'on annonce est la position RÉELLE et non celle qu'on visait. */
      setAnnonce(
        t('app.portfolio.unitMoved', {
          unit: libelle,
          rang: String(vers + 1),
          total: String(suivant.length),
        }),
      )
      return suivant
    })
  }

  const peutAller = (cle: string, sens: -1 | 1) => {
    const index = clesAffichees.indexOf(cle)
    const vers = index + sens
    return index !== -1 && vers >= 0 && vers < clesAffichees.length
  }

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
    <DeplacementDeFiche.Provider value={{ deplacer: deplacerParLeMenu, peutAller }}>
    <div className="relative min-w-0">
      <ul
        id={id}
        ref={rail}
        aria-label={libelle}
        onScroll={mesurer}
        onPointerDown={(e) => {
          auPointeurEnfonceSurFiche(e)
          auPointeurEnfonce(e)
        }}
        onPointerMove={(e) => {
          auPointeurDeplaceSurFiche(e)
          auPointeurDeplace(e)
        }}
        onPointerUp={(e) => {
          auPointeurRelacheSurFiche()
          auPointeurRelache(e)
        }}
        onPointerCancel={(e) => {
          auPointeurRelacheSurFiche()
          auPointeurRelache(e)
        }}
        onClickCapture={auClicEnCapture}
        data-mesure="sections-alignees"
        className={cn(
          /* CINQ RANGÉES DÉCLARÉES : ce sont celles que `subgrid` reprend. Les
             nommer ici est la condition pour que les fiches s'alignent. */
          'grid snap-x snap-proximity grid-flow-col grid-rows-[repeat(5,auto)]',
          'auto-cols-[minmax(min(100%,18rem),18rem)] gap-x-3',
          /*
            LA MAIN NE PARAÎT QUE S'IL Y A QUELQUE CHOSE À TIRER — MAIS IL Y A
            DEUX CHOSES, ET LA CONDITION N'EN COUVRAIT QU'UNE.

            Elle était écrite `flecheVisible`, c'est-à-dire « ce rail déborde
            vraiment » — le fait qui décide des deux flèches. C'est la bonne
            condition pour le PANORAMIQUE : pousser une rangée qui tient entière
            ne mène nulle part. Ce n'en est pas une pour le RÉORDONNANCEMENT, qui
            ne demande rien d'autre que deux fiches : `auPointeurEnfonceSurFiche`
            n'a jamais regardé le débordement.

            CE QUE ÇA DONNAIT : un immeuble de trois logements dans une fenêtre
            large est réordonnable au glissement, et le curseur ne changeait pas
            d'un pixel — un geste utilisable, et rien pour le dire. L'affordance
            était accrochée au débordement, donc à l'autre geste.

            `clesAffichees.length > 1` plutôt qu'un compte de fiches servies : ce
            qui compte est ce qui est AFFICHÉ, et c'est la liste réconciliée.

            RIEN NE GARDE CES CLASSES DERRIÈRE UN POINTEUR FIN, et c'est
            volontaire : un appareil sans curseur n'a pas de curseur à changer,
            la règle y est inerte. La variante coûterait une condition à tenir
            pour rien.

            `select-none` PENDANT LA SAISIE SEULEMENT : tirer sur du texte le
            sélectionne, et une rangée bleue qui suit la souris est le signe le
            plus sûr d'un glissement mal fait. Au repos, le texte des fiches doit
            rester copiable — un montant, un nom de locataire.
          */
          (flecheVisible || clesAffichees.length > 1) && 'cursor-grab',
          saisi && 'cursor-grabbing select-none',
          /* LA FICHE PRISE S'ALLÈGE — le seul retour visuel du déplacement,
             puisqu'elle ne suit pas le curseur (voir le docbloc de l'ordre). Une
             opacité, et non une ombre ni une échelle : les deux dernières sont
             des transformations ou des peintures qui feraient sortir la fiche de
             l'alignement de `subgrid` ou coûteraient une couche de plus.
             `select-none` pendant le déplacement pour la même raison qu'au
             panoramique : tirer sur du texte le sélectionne. */
          cleDeplacee !== null && 'select-none',
          '[&_[data-deplacee]]:opacity-60',
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
        {/*
          LES FICHES SORTENT DANS L'ORDRE RETENU, et chacune reçoit un drapeau
          quand c'est elle qu'on déplace. `cloneElement` plutôt qu'une enveloppe :
          une balise de plus entre la grille et ses fiches romprait
          `grid-rows-subgrid`, qui exige que la fiche soit l'enfant DIRECT de la
          grille — c'est la contrainte que l'en-tête de ce fichier dit « à ne pas
          casser ».
        */}
        {clesAffichees.map((cle) => {
          const enfant = parCle.get(cle)
          if (!enfant) return null
          return cloneElement(enfant, {
            ...(cle === cleDeplacee ? { 'data-deplacee': '' } : {}),
          } as Record<string, unknown>)
        })}
        {/* La tuile de fin, dernière colonne de la grille — voir `queue`. */}
        {queue}
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

      {/*
        HORS DU `<ul>`, ET CE N'EST PAS UN DÉTAIL DE RANGEMENT. Le rail est une
        boîte de défilement, et un `sr-only` posé dedans s'en échappe pour aller
        étendre le défilement du document — c'est le relevé que le docbloc du
        `<ul>` porte déjà : « la mention “rien à payer” d'un logement vacant,
        invisible et large de 185 px, tirait la page entière à 1 432 px ». Posée
        ici, sous un parent `relative`, elle est rognée par lui et ne fuit pas.
      */}
      <p className="sr-only" aria-live="polite">
        {annonce}
      </p>

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
    </DeplacementDeFiche.Provider>
  )
}

/** L'écart entre deux fiches, en pixels — `gap-x-3`, tenu ici pour le pas. */
const ECART_PX = 12

/** Déplacement au-delà duquel un appui devient un glissement, en pixels. */
const SEUIL_DE_GLISSEMENT_PX = 4

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
