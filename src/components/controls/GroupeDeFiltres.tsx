import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * LA RANGÉE DE FILTRES, écrite UNE fois.
 *
 * CE QU'ELLE REMPLACE : trois copies — le parc, les paiements, les travaux —
 * partageant le MÊME littéral de classes, au caractère près, y compris le long
 * commentaire qui justifie la couleur du compteur. Trois copies d'une
 * justification, c'est trois occasions d'en corriger deux.
 *
 * LE FILTRE ACTIF RESTE `bg-ink` ET NON L'ACCENT, et c'est une distinction de
 * sens, pas un oubli. Le bleu de l'accent désigne L'ACTION — il peint le bouton
 * primaire. Un filtre actif ne propose pas un geste : il dit dans quel état on
 * se trouve. Les peindre pareil ferait lire « Payés » comme une chose à faire.
 *
 * EN GÉLULE, comme tout ce qui se clique depuis le lot de géométrie. C'était
 * `rounded-md`, ce qui les rendait indistinguables d'un champ de saisie de même
 * hauteur posé à côté.
 *
 * LE COMPTEUR EST FACULTATIF : le parc filtre par immeuble sans compter, les
 * deux autres écrans comptent. Une propriété qu'on peut omettre vaut mieux
 * qu'un zéro qui ne veut rien dire.
 */

export interface OptionDeFiltre<T extends string> {
  valeur: T
  libelle: string
  /** Omis, aucun compteur ne s'affiche — voir l'en-tête. */
  compte?: number
}

export function GroupeDeFiltres<T extends string>({
  libelle,
  libelleVisible = false,
  valeur,
  onChange,
  options,
  className,
}: {
  /** Nom du GROUPE pour les technologies d'assistance, pas de ses options. */
  libelle: string
  /**
   * ═══ QUAND DEUX GROUPES SE SUIVENT, LE LECTEUR D'ÉCRAN LES DISTINGUE ET
   *     L'ŒIL NON ═══
   *
   * Un seul groupe n'a pas besoin d'être nommé : ses pastilles le disent —
   * « Payés », « Partiels », « En retard » ne peuvent être qu'un état. Le nom
   * reste alors réservé aux technologies d'assistance, qui, elles, ne voient
   * pas la page.
   *
   * L'écran des travaux en porte DEUX, côte à côte : l'origine du chantier et
   * son état. Chacun ouvre par une pastille « Tout », chacune est active, et
   * les deux sont peintes en encre pleine — vu à la capture, « Tout 6 » et
   * « Tous les états 6 » à vingt-quatre pixels l'une de l'autre, qui se lisent
   * comme une contradiction. Les noms EXISTENT — `aria-label` les porte depuis
   * toujours — mais ils sont invisibles, et la seule frontière visible est
   * `gap-x-6` contre `gap-2` : trois fois l'écart intérieur, ce qui ne suffit
   * pas quand les pastilles font quarante-quatre pixels de haut.
   *
   * Rendre le nom VISIBLE ne coûte aucune chaîne nouvelle : c'est le même, déjà
   * traduit. `aria-label` disparaît alors au profit d'`aria-labelledby`, sans
   * quoi le groupe porterait son nom deux fois pour un lecteur d'écran.
   */
  libelleVisible?: boolean
  valeur: T
  onChange: (valeur: T) => void
  options: OptionDeFiltre<T>[]
  className?: string
}) {
  const idDuLibelle = useId()

  return (
    <div
      role="group"
      aria-label={libelleVisible ? undefined : libelle}
      aria-labelledby={libelleVisible ? idDuLibelle : undefined}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {libelleVisible && (
        <span id={idDuLibelle} className="eyebrow mr-1 text-muted">
          {libelle}
        </span>
      )}
      {options.map((option) => {
        const actif = option.valeur === valeur
        return (
          <button
            key={option.valeur}
            type="button"
            /* `aria-pressed` et non `aria-selected` : ce sont des boutons à deux
               états, pas des onglets. Un lecteur d'écran annonce « activé », ce
               qui est exactement ce qu'un filtre appliqué veut dire. */
            aria-pressed={actif}
            onClick={() => onChange(option.valeur)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5',
              'text-label font-semibold transition-colors duration-150',
              actif
                ? 'border-ink bg-ink text-on-dark'
                : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
            )}
          >
            {option.libelle}
            {option.compte !== undefined && (
              /*
                `accent-on-ink` ET NON `accent`, et cette justification vivait en
                TROIS exemplaires avant d'être écrite ici.

                Le filtre actif peint son fond en `--color-ink`, qui s'inverse
                avec le thème. À 12 px ce compteur est du TEXTE, donc il lui faut
                4,5:1 — et `--color-accent` ne s'inverse PAS : il garde la même
                valeur dans les deux thèmes, si bien que la paire casse du côté
                sombre. Elle n'y rendait que 2,33 du temps où l'accent était or,
                et le bleu qui l'a remplacé hérite du même défaut d'appariement,
                qui tient à la FIXITÉ du jeton et non à sa teinte.

                `accent-on-ink` suit le fond qu'il nomme : 6,26 sur l'encre du
                thème clair, 5,56 sur celle du thème sombre.
              */
              <span
                /* `data-valeur` : ce compteur EST un chiffre, et une porte le
                   juge comme tel. `espace-connecte` refuse une rangée de chiffres
                   MUETS au-dessus d'un état vide de page — « Tous 0 · À jour 0 ·
                   Partiel 0 · En retard 0 » au-dessus de « aucun paiement ». Le
                   marqueur est celui que porte déjà la valeur d'une carte
                   d'indicateur : une même question, un même attribut. */
                data-valeur=""
                className={cn('numeric text-label', actif ? 'text-accent-on-ink' : 'text-muted')}
              >
                {option.compte}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
