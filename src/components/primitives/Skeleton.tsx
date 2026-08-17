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
  /** `--text-body-s` — 13px × 1.5 */
  bodyS: 'h-[1.22rem]',
  /** `--text-body` — 14px × 1.55 */
  body: 'h-[1.35rem]',
  /** `--text-title-m` — 17px × 1.35 */
  title: 'h-[1.44rem]',
  /** `--text-kpi` — 26px × 1 */
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
      <Skeleton line="bodyS" className="mt-2 w-28" />
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
      <div className="flex items-center gap-4 border-b border-divider bg-surface-sunken px-4 py-3">
        {COLONNES.map((colonne, index) => (
          <Skeleton
            key={index}
            line="eyebrow"
            className={cn(colonne.largeur, colonne.mobile ? undefined : 'hidden sm:block')}
          />
        ))}
      </div>

      {Array.from({ length: rows }, (_, ligne) => (
        <div
          key={ligne}
          className="flex items-center gap-4 border-b border-divider px-4 py-3 last:border-0"
        >
          {COLONNES.map((colonne, index) => (
            <Skeleton
              key={index}
              line="body"
              className={cn(colonne.largeur, colonne.mobile ? undefined : 'hidden sm:block')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Gabarit de colonnes. `mobile: false` reprend `hideOnMobile` de `DataTable` :
 * un squelette qui montrerait six colonnes sur 375px annoncerait un tableau
 * que l'écran ne rendra pas.
 */
const COLONNES = [
  { largeur: 'w-10', mobile: true },
  { largeur: 'w-28', mobile: false },
  { largeur: 'w-24', mobile: false },
  { largeur: 'w-32', mobile: true },
  { largeur: 'w-20', mobile: true },
  { largeur: 'w-16', mobile: true },
]
