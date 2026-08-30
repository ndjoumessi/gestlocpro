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
  valeur,
  onChange,
  options,
  className,
}: {
  /** Nom du GROUPE pour les technologies d'assistance, pas de ses options. */
  libelle: string
  valeur: T
  onChange: (valeur: T) => void
  options: OptionDeFiltre<T>[]
  className?: string
}) {
  return (
    <div role="group" aria-label={libelle} className={cn('flex flex-wrap gap-2', className)}>
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
              <span className={cn('numeric text-caps', actif ? 'text-accent-on-ink' : 'text-muted')}>
                {option.compte}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
