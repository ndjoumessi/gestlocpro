import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: string
  error?: string
}

export function Checkbox({ label, hint, error, className, ...props }: CheckboxProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  /*
    L'ERREUR EST RATTACHÉE, et elle ne l'était pas.

    Le paragraphe de refus portait `role="alert"` mais AUCUN identifiant, et
    `aria-describedby` ne citait que l'aide. Le motif du refus n'était donc
    lié à rien : quiconque revient sur la case après coup — au clavier, ou
    en la relisant — n'entend que son libellé, jamais pourquoi elle bloque.
    C'est le refus des conditions générales, à l'inscription, qui en dépend.

    L'aide persiste ici pour la même raison que dans `Field`, et les deux
    identifiants sont cités ensemble.
  */
  const decritPar = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* La zone cliquable couvre le label entier, pas seulement la case,
          et fait au moins 44px de haut. */}
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            aria-describedby={decritPar}
            aria-invalid={error ? true : undefined}
            className={cn(
              'peer size-5 cursor-pointer appearance-none rounded-sm border bg-surface',
              'transition-colors duration-150',
              'checked:border-ink checked:bg-ink',
              error ? 'border-danger' : 'border-border-strong',
            )}
            {...props}
          />
          <Icon
            name="check"
            size={13}
            strokeWidth={2.6}
            className="pointer-events-none absolute text-on-dark opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span className="text-body text-ink">{label}</span>
      </label>

      {hint && (
        <p id={hintId} className="pl-8 text-body text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 pl-8 text-body font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  )
}

export interface RadioCardOption<T extends string> {
  value: T
  title: string
  description: string
  icon?: IconName
  /** Ligne d'appui affichée en bas de la carte, en mono. */
  footnote?: string
}

export interface RadioCardsProps<T extends string> {
  /** Libellé du groupe — rendu en `<legend>`. */
  legend: string
  /** Masque visuellement la légende sans la retirer de l'arbre a11y. */
  hideLegend?: boolean
  name: string
  value: T | null
  onChange: (value: T) => void
  options: RadioCardOption<T>[]
  columns?: 1 | 2 | 3
  /**
   * `cartes` — une tuile par option : icône, titre, description, marque de
   * sélection. C'est la forme du choix de rôle à l'inscription, où chaque
   * option porte réellement une icône distincte et deux lignes d'explication.
   *
   * `puces` — une rangée de pastilles qui se replie, un mot par pastille.
   *
   * QUAND EMPLOYER `puces`, ET POURQUOI CE VARIANT EXISTE. Mesuré sur « Ouvrir
   * un chantier » : six corps de métier et trois urgences, tous avec
   * `description: ''` et sans icône, rendus en tuiles pleine largeur. Le corps
   * de la modale mesurait 1517 px pour une fenêtre de 484 — soit 1033 px de
   * défilement pour neuf mots. Et comme aucune option ne fournissait d'icône,
   * les six tuiles affichaient la MÊME icône de repli : une distinction promise
   * à l'œil, et démentie.
   *
   * La règle qui en sort : une option sans description ET sans icône n'a rien à
   * mettre dans une tuile. `puces` est alors la forme juste, et `cartes` est un
   * mensonge de mise en page.
   */
  variant?: 'cartes' | 'puces'
  className?: string
}

/**
 * Cartes radio — utilisées pour le choix de rôle à l'inscription.
 * Sémantique `fieldset`/`legend` + vrais `input[type=radio]` : la navigation
 * clavier par flèches et l'annonce « 1 sur 3 » sont natives.
 */
export function RadioCards<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  onChange,
  options,
  columns = 3,
  variant = 'cartes',
  className,
}: RadioCardsProps<T>) {
  if (variant === 'puces') {
    return (
      <RadioPuces
        legend={legend}
        hideLegend={hideLegend}
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        className={className}
      />
    )
  }
  const gridClass =
    columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <fieldset className={cn('min-w-0 border-0 p-0', className)}>
      <legend className={cn('mb-3 text-label font-semibold text-ink', hideLegend && 'sr-only')}>
        {legend}
      </legend>

      <div className={cn('grid gap-3', gridClass)}>
        {options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                'group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4',
                'transition-[border-color,background-color,box-shadow] duration-150 ease-out',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-ink',
                checked
                  ? 'border-ink bg-surface shadow-e1'
                  : 'border-border bg-surface/60 hover:border-border-strong hover:bg-surface',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
                    // `gold-on-ink` et non l'or de marque : sur `--color-ink`,
                    // qui s'inverse avec le thème, l'or fixe tombait à 2,33:1 en
                    // sombre. L'icône de la tuile SÉLECTIONNÉE était alors
                    // l'élément le moins lisible de la carte.
                    checked ? 'bg-ink text-gold-on-ink' : 'bg-surface-sunken text-muted',
                  )}
                >
                  <Icon name={option.icon ?? 'users'} size={18} />
                </span>

                {/* Marque de sélection : forme + couleur, jamais la couleur seule. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150',
                    checked ? 'border-ink bg-ink text-on-dark' : 'border-border-strong',
                  )}
                >
                  {checked && <Icon name="check" size={11} strokeWidth={3} />}
                </span>
              </div>

              <span className="title-m text-ink">{option.title}</span>
              <span className="text-body text-muted">{option.description}</span>

              {option.footnote && (
                <span className="eyebrow mt-1 border-t border-divider pt-2.5 text-muted">
                  {option.footnote}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * PASTILLES RADIO — un mot par option, sur une rangée qui se replie.
 *
 * MÊME SÉMANTIQUE QUE LES TUILES, et c'est la condition pour que ce soit un
 * variant et non un autre composant : `fieldset`/`legend`, de vrais
 * `input[type=radio]` d'un même `name`. La navigation aux flèches, l'annonce
 * « 2 sur 6 » et le groupement sont donc natifs, exactement comme avant. Rien
 * de ce que le clavier ou le lecteur d'écran obtenait n'est perdu ; c'est la
 * PLACE qui change.
 *
 * LA SÉLECTION N'EST PAS PORTÉE PAR LA COULEUR SEULE. La pastille retenue prend
 * l'encre ET une coche : c'est la règle du dépôt, et elle vaut ici comme sur la
 * grille des paiements — sous deutéranopie, deux teintes de statut sont à 3,4
 * de ΔE00, c'est-à-dire le même aplat. La coche est `aria-hidden` : l'état
 * coché est déjà annoncé par le radio lui-même, et le redire en ferait deux.
 *
 * `min-h-11` : une pastille est une cible, pas une étiquette. 44 px, comme tout
 * ce qu'on touche dans ce produit.
 *
 * L'ICÔNE, SI ELLE EXISTE, EST RENDUE. Une option qui en fournit une distincte
 * mérite qu'on la montre ; ce que ce variant refuse, c'est l'icône de REPLI —
 * la même pour toutes, qui promet une distinction inexistante.
 */
function RadioPuces<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  onChange,
  options,
  className,
}: Omit<RadioCardsProps<T>, 'columns' | 'variant'>) {
  return (
    <fieldset className={cn('min-w-0 border-0 p-0', className)}>
      <legend className={cn('mb-2 text-label font-semibold text-ink', hideLegend && 'sr-only')}>
        {legend}
      </legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3',
                'text-label transition-colors duration-150',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-ink',
                checked
                  ? 'border-ink bg-ink text-on-dark'
                  : 'border-border bg-surface text-ink hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* Forme ET couleur : la coche dit le choix à qui ne distingue pas
                  l'encre du fond. `aria-hidden`, l'état est déjà annoncé. */}
              {checked && <Icon name="check" size={13} strokeWidth={3} aria-hidden="true" />}
              {option.icon && !checked && <Icon name={option.icon} size={14} />}
              {option.title}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Bascule segmentée à deux états — mensuel/annuel, solo/délégué. */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; badge?: string }[]
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-surface p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-3.5',
              'text-label font-semibold transition-colors duration-150 ease-out',
              active ? 'bg-ink text-on-dark' : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {option.label}
            {option.badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 numeric text-caps',
                  // La pastille de remise suit l'accent unique. Elle était en
                  // vert de succès, seule tache de couleur restante sur la
                  // landing une fois les autres neutralisées.
                  active ? 'bg-gold text-ink' : 'bg-gold-tint text-gold-ink',
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
