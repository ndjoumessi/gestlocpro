import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

/**
 * Squelette de chargement.
 *
 * Extrait de l'écran « états du système », qui en portait déjà un — mais en
 * vitrine, câblé à rien. Le produit avait donc le dessin de l'attente sans
 * l'attente elle-même, pendant que les écrans réels servaient le jeu de
 * DÉMONSTRATION le temps que le parc du serveur arrive. Sur le réseau du marché
 * visé, cela dure plusieurs secondes, et le propriétaire lit les immeubles et
 * les impayés de quelqu'un d'autre en croyant lire les siens.
 *
 * Trois règles gouvernent ce composant.
 *
 * 1. **Il tient la place.** Un squelette plus court que son contenu ne fait que
 *    déplacer le problème : l'attente cesse, la page sursaute, et le doigt
 *    tombe à côté de ce qu'il visait. D'où `LIGNES`, calé sur les boîtes de
 *    ligne réelles des styles de texte, plutôt que des hauteurs choisies à
 *    l'œil.
 * 2. **Il ne dit rien de faux.** Le décor est retiré de l'arbre
 *    d'accessibilité ; une seule région annonce poliment l'attente. Voir
 *    `SkeletonRegion`.
 * 3. **Il ne coûte rien à afficher.** Le mouvement porte sur un `transform`
 *    composé, jamais sur une propriété qui repeint ou remet en page. La règle
 *    `.gl-skeleton` vit dans `design-system/tokens.css`, avec les autres
 *    images-clés `gl-*` et la prise en charge de `prefers-reduced-motion`.
 */

/**
 * Hauteurs calées sur les styles de texte de `tokens.css`.
 *
 * Chaque valeur est la BOÎTE DE LIGNE — taille × interligne — du style qu'elle
 * remplace, et non la taille de police. C'est la boîte qui occupe la place :
 * substituer 14px à une ligne de corps qui en mesure 21,7 rendrait le squelette
 * plus court que le texte, et toute la page remonterait à l'arrivée des
 * données.
 */
const LIGNES = {
  /** `eyebrow` — 12px × 1.3 */
  eyebrow: 'h-[0.975rem]',
  /**
   * `--text-body` — 14 px × 1,55.
   *
   * `bodyS` A DISPARU, ET IL AVAIT SURVÉCU À SON JETON. Il valait `h-[1.22rem]`,
   * calé sur un `--text-body-s` de 13 px que le lot de typographie a SUPPRIMÉ en
   * migrant ses 110 emplois sur `--text-body`. Le pavé est donc resté deux
   * pixels plus court que le texte qu'il remplace, sur huit emplois, avec un
   * commentaire qui citait « 13 px » sous un jeton qui en vaut 14. Un squelette
   * plus court que son contenu est exactement ce que l'en-tête de ce fichier
   * interdit : la page remonte à l'arrivée des données.
   */
  body: 'h-[1.35rem]',
  /**
   * `--text-title-m` — 16 px × 1,35.
   *
   * Valait `h-[1.44rem]`, calé sur 17 px. Le jeton a été REPLIÉ à 16 au lot de
   * typographie et le pavé est resté : 1,4 px de TROP, cette fois, et la page
   * descendait d'autant à l'arrivée du titre. Le sens de l'erreur change, le
   * défaut est le même — une hauteur qui ne suit plus son jeton.
   */
  title: 'h-[1.35rem]',
  /** `--text-kpi` — 26 px × 1 */
  kpi: 'h-[1.625rem]',
} as const

export type SkeletonLine = keyof typeof LIGNES

const RAYONS = {
  /** Une ligne de texte : pleinement arrondie, comme un mot surligné. */
  full: 'rounded-full',
  /** Un contrôle — bouton, champ. Même rayon que `Button`. */
  md: 'rounded-md',
  /** Un pavé — graphique, vignette. Même rayon qu'une carte. */
  lg: 'rounded-lg',
} as const

export interface SkeletonProps {
  /** Hauteur du style de texte remplacé. Sans elle, la hauteur vient de `className`. */
  line?: SkeletonLine
  radius?: keyof typeof RAYONS
  /** Largeur libre (« 62 % ») là où aucune classe utilitaire ne convient. */
  width?: string
  className?: string
}

/**
 * Un pavé de substitution. Toujours décoratif : `aria-hidden` n'est pas
 * paramétrable, parce qu'un squelette n'a jamais rien à annoncer — l'annonce
 * appartient à la région qui l'entoure, une fois, pas à chacun de ses pavés.
 */
export function Skeleton({ line, radius = 'full', width, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'gl-skeleton block shrink-0 bg-surface-sunken',
        RAYONS[radius],
        line && LIGNES[line],
        className,
      )}
      style={width ? { width } : undefined}
    />
  )
}

export interface SkeletonRegionProps {
  children: ReactNode
  /** Par défaut « Chargement… ». À préciser quand la page en charge deux à la fois. */
  label?: string
  className?: string
}

/**
 * Enveloppe annonçant l'attente.
 *
 * Le partage est délibéré : `aria-hidden` sur chaque pavé, UNE `role="status"`
 * pour tout le bloc.
 *
 * Décrire le décor serait le plus mauvais des trois choix — un lecteur d'écran
 * énumérerait quinze régions vides avant d'atteindre quoi que ce soit d'utile,
 * et les lignes du squelette de tableau passeraient pour des logements. Se
 * taire complètement serait le deuxième : l'écran resterait silencieux pendant
 * les quelques secondes qui séparent la navigation de l'arrivée des données,
 * exactement le laps où l'on se demande si le geste a été pris en compte.
 *
 * `role="status"` porte un `aria-live="polite"` implicite : annoncé à la
 * respiration suivante, sans couper la lecture en cours ni voler le focus.
 * `aria-busy` s'y ajoute et ne fait pas double emploi — il dit que la zone est
 * en cours de remplissage, ce qui invite les technologies d'assistance à ne pas
 * présenter un contenu partiel.
 *
 * La région disparaît avec l'attente. Elle n'annonce pas « chargé » : le titre
 * de la page n'a pas bougé, l'utilisateur est resté au même endroit, et une
 * seconde annonce ne ferait que répéter ce que la première a promis.
 */
export function SkeletonRegion({ children, label, className }: SkeletonRegionProps) {
  const t = useT()
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label ?? t('common.loading')}</span>
      {children}
    </div>
  )
}

/**
 * Carte d'indicateur en attente.
 *
 * Reproduit la boîte de `StatCard` (`Charts.tsx`) — mêmes classes de carte,
 * mêmes marges, mêmes hauteurs de ligne — pour que la rangée d'indicateurs ne
 * change pas d'un pixel quand les chiffres arrivent. Le couplage est réel : si
 * `StatCard` change de gabarit, celle-ci doit suivre.
 */
export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5">
      <Skeleton line="eyebrow" className="w-24" />
      <Skeleton line="kpi" radius="md" className="mt-2 w-32" />
      <Skeleton line="body" className="mt-2 w-28" />
    </div>
  )
}

/**
 * LA RANGÉE D'INDICATEURS EN ATTENTE.
 *
 * CE QU'ELLE REMPLACE : six copies du même bloc de cinq lignes, dans six
 * écrans — tableau de bord, locataire, encaissements, relevés, parc, cautions.
 * Chacune ouvrait une grille, y déroulait `[0, 1, 2]` ou `[0, 1, 2, 3]` et
 * posait une `SkeletonStatCard`. Rien à décider, six endroits où se tromper.
 *
 * LA GRILLE N'EST PAS UN DÉFAUT DE LA RANGÉE : ELLE VIENT DE L'ÉCRAN, et c'est
 * tout l'intérêt. Un squelette d'indicateurs n'a pas de gabarit propre — il
 * emprunte celui de la rangée CHARGÉE, faute de quoi la page se réorganise à
 * l'arrivée des données. L'appelant passe donc la constante qu'il emploie déjà
 * pour sa vraie rangée, et les deux ne peuvent plus diverger sans que l'une des
 * deux perde sa source.
 *
 * ELLES AVAIENT DÉJÀ DIVERGÉ, et c'est ce refactoring qui l'a montré. L'espace
 * locataire attendait sous quatre cartes égales en `sm:grid-cols-2
 * xl:grid-cols-4`, puis chargeait TROIS cartes inégales en
 * `lg:grid-cols-[1.4fr_1fr_1fr]` : une carte de trop, un point de rupture qui
 * n'existait pas, et une réorganisation complète au moment précis où l'écran
 * cesse d'attendre. Aucune porte ne pouvait le voir — aucune ne rend jamais un
 * état de chargement. `squelettesFideles.test.ts` le tient désormais à la
 * source.
 */
export function SkeletonStatRow({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, carte) => (
        <SkeletonStatCard key={carte} />
      ))}
    </div>
  )
}

/**
 * Tableau en attente.
 *
 * Bâti en `div` et non en `<table>` : les cellules sont vides, et une vraie
 * table les annoncerait comme des lignes de données — un lecteur d'écran
 * compterait huit logements inexistants. Les classes de rembourrage sont en
 * revanche celles de `DataTable`, parce que c'est de là que vient la hauteur.
 *
 * `rows` n'est pas devinable : on ne sait pas combien de logements le serveur
 * va rendre. Huit remplit l'écran d'un téléphone sans le dépasser — le
 * dépassement se paierait en défilement fantôme, le manque en saut de mise en
 * page vers le bas, qui est le moins coûteux des deux.
 */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-divider bg-surface shadow-e1">
      <div className={cn(RANGEE, 'border-b border-divider bg-surface-sunken')}>
        {COLONNES.map((colonne, index) => (
          <Skeleton
            key={index}
            line="eyebrow"
            className={cn('w-full', colonne.mobile ? undefined : 'hidden sm:block')}
          />
        ))}
      </div>

      {Array.from({ length: rows }, (_, ligne) => (
        <div key={ligne} className={cn(RANGEE, 'border-b border-divider last:border-0')}>
          {COLONNES.map((colonne, index) => (
            <Skeleton
              key={index}
              line="body"
              className={cn('w-full', colonne.mobile ? undefined : 'hidden sm:block')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Rangée en GRILLE, et non en ligne flexible à largeurs fixes.
 *
 * Les colonnes valaient `w-10 w-28 w-24 w-32 w-20 w-16`, portées par des pavés
 * en `shrink-0`. À 375px, les quatre colonnes visibles totalisaient 360px de
 * contenu et de gouttières pour 283px disponibles : le conteneur porte
 * `overflow-hidden`, donc la dernière colonne était simplement COUPÉE. Le vrai
 * `DataTable`, lui, porte `overflow-x-auto` et défile — le squelette rognait là
 * où le tableau qu'il annonce se déroule, et sur la cible 375px du produit.
 *
 * Le défaut ne se voyait nulle part parce qu'aucun squelette n'est jamais
 * apparu à l'écran : la démonstration n'attend rien, et le compte qui ferait
 * attendre les écrans réels n'existe pas encore. Il a fallu poser le composant
 * dans la vitrine pour qu'il se montre.
 *
 * Des fractions plutôt que des pixels : la rangée épouse son conteneur à toute
 * largeur, dans une carte de demi-colonne comme sur une page entière, et ne
 * peut plus déborder par construction. Les proportions gardent l'allure d'un
 * tableau — une colonne de tête étroite, un libellé large, des valeurs
 * courtes — et le rembourrage reste celui de `DataTable`, puisque c'est de lui
 * que vient la hauteur.
 *
 * Les gabarits comptent les colonnes VISIBLES : quatre sous `sm`, six au-delà.
 * Un élément en `display: none` est retiré de la grille et n'y occupe aucune
 * piste, donc les deux listes doivent correspondre exactement aux `mobile`
 * ci-dessous.
 */
const RANGEE =
  'grid grid-cols-[2rem_1.8fr_1.1fr_0.9fr] sm:grid-cols-[2rem_1.6fr_1.3fr_1.8fr_1.1fr_0.9fr] items-center gap-4 px-4 py-3'

/**
 * Gabarit de colonnes. `mobile: false` reprend `hideOnMobile` de `DataTable` :
 * un squelette qui montrerait six colonnes sur 375px annoncerait un tableau
 * que l'écran ne rendra pas.
 */
const COLONNES = [
  { mobile: true },
  { mobile: false },
  { mobile: false },
  { mobile: true },
  { mobile: true },
  { mobile: true },
]
