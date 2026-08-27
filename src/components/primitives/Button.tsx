import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'onDark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // Une seule action primaire par écran.
  /**
   * LE PRIMAIRE PREND L'ACCENT, ET IL NE POUVAIT PAS AVANT.
   *
   * Il était `bg-ink` — presque noir — et ce n'était pas un choix esthétique
   * mais une contrainte : l'or de marque ne tenait que 2,87:1 sur blanc, donc
   * il ne pouvait porter aucune encre lisible et ne pouvait pas être le fond
   * de l'action. Le geste principal du produit était noir FAUTE de mieux.
   *
   * `--color-accent` tient 5,17:1 sous du blanc, dans les deux thèmes, et 3,13
   * contre la carte sombre — au-dessus du seuil de 3:1 d'un élément
   * d'interface. La contrainte est levée, le bouton prend la couleur de la
   * marque, et l'écran dit enfin en couleur où se trouve son action.
   *
   * `shadow-e1` et non un littéral : l'ombre portait `rgba(20,32,30,.18)`,
   * c'est-à-dire `--color-ink` figé à 18 %. Une ombre d'encre sombre posée sur
   * un fond sombre ne se voit pas — le jeton d'élévation, lui, se redéfinit
   * avec le thème.
   */
  primary: 'bg-accent text-on-accent shadow-e1 hover:bg-accent-hover active:translate-y-px',
  secondary:
    'bg-surface text-ink border border-border hover:border-ink active:translate-y-px',
  ghost: 'bg-transparent text-ink hover:bg-surface-sunken active:translate-y-px',
  /* Le second aplat d'accent, désormais IDENTIQUE au primaire par sa couleur —
     ce qui pose la question de sa survie. Il est laissé tel quel : le
     supprimer, c'est retirer une variante de l'API du composant le plus employé
     du produit, et ce n'est pas le sujet de ce lot. Nommé au rapport. */
  accent: 'bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px',
  danger: 'bg-danger text-on-dark hover:bg-danger-strong active:translate-y-px',
  onDark:
    'bg-on-dark-active text-on-dark border border-on-dark-border hover:bg-on-dark/20 active:translate-y-px',
}

/**
 * L'amortissement d'un contrôle désactivé, nommé une seule fois.
 *
 * `IconButton` composait `VARIANTS[variant]` sans passer par `classes()` : un
 * bouton icône désactivé gardait son opacité pleine et son curseur de main,
 * donc rien ne le distinguait d'un bouton actif — alors que le `Button`
 * ordinaire s'éteignait. Extraire le fragment plutôt que le recopier garantit
 * que les deux resteront d'accord : il n'y a plus qu'un endroit où le changer.
 *
 * `pointer-events-none` en plus de l'attribut `disabled` : il coupe aussi le
 * survol et le curseur, que l'attribut natif laisse passer sur les descendants.
 */
const ETEINT = 'pointer-events-none opacity-45'

const SIZES: Record<ButtonSize, string> = {
  // min-h-11 = 44px, la cible tactile minimale, sur toutes les tailles.
  sm: 'min-h-11 px-3 text-label gap-1.5',
  md: 'min-h-11 px-3.5 text-body gap-2',
  lg: 'min-h-12 px-5 text-body-l gap-2',
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconAfter?: IconName
  loading?: boolean
  fullWidth?: boolean
  children?: ReactNode
  className?: string
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> {
  /** Rend un `<Link>` interne à la place d'un `<button>`. */
  to?: string
  /** Rend un `<a>` externe. */
  href?: string
}

function classes({
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  className,
}: CommonProps & { disabled?: boolean }) {
  return cn(
    'inline-flex items-center justify-center rounded-md font-semibold no-underline',
    'cursor-pointer select-none whitespace-nowrap',
    'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    disabled && ETEINT,
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconAfter, loading, fullWidth, children, className, to, href, disabled, ...props },
  ref,
) {
  const iconSize = size === 'lg' ? 18 : 16
  const isDisabled = disabled || loading

  const content = (
    <>
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: 'gl-spin 700ms linear infinite' }}
        />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} size={iconSize} />}
    </>
  )

  const shared = classes({ variant, size, fullWidth, disabled: isDisabled, className })

  /**
   * Les branches « lien » transmettent AUSSI les propriétés restantes.
   *
   * Elles les jetaient silencieusement : un `<Button to="…" onClick={…}>`
   * ignorait son gestionnaire, et un `aria-label` posé par l'appelant
   * disparaissait sans erreur ni avertissement. Un composant partagé qui trahit
   * ses appelants en silence est le pire des trois — il n'échoue pas, il ment.
   *
   * Le type restant décrit un `<button>` : quelques attributs n'ont pas de sens
   * sur une ancre. La conversion est donc explicite et bornée à ce point, plutôt
   * que de dupliquer la signature du composant pour trois branches.
   */
  const reste = props as unknown as AnchorHTMLAttributes<HTMLAnchorElement>

  /**
   * Un lien désactivé perd sa DESTINATION, et pas seulement son apparence.
   *
   * `aria-disabled` seul annonce l'état aux technologies d'assistance et ne
   * change rien au comportement : l'ancre restait cliquable, focalisable et
   * activable au clavier. Sans `href`, elle sort du parcours de tabulation et
   * ne navigue plus — ce que « désactivé » veut dire.
   */
  if ((to || href) && isDisabled) {
    return (
      <span className={shared} aria-disabled="true" {...reste}>
        {content}
      </span>
    )
  }

  if (to) {
    return (
      <Link to={to} className={shared} {...reste}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={shared} {...reste}>
        {content}
      </a>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      className={shared}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  )
})

/** Bouton icône seule — exige un libellé accessible. */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  label: string
  variant?: ButtonVariant
  size?: number
  className?: string
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 16,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md',
        'transition-colors duration-150 ease-out',
        VARIANTS[variant],
        disabled && ETEINT,
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
