import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark'
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
  /* `accent` A ÉTÉ RETIRÉ, et le lot précédent l'avait annoncé.
     Il valait `bg-accent text-on-accent hover:bg-accent-hover` — c'est-à-dire
     EXACTEMENT `primary`, au caractère près, depuis que le primaire a pris la
     couleur de la marque. Deux noms pour une seule apparence, sur le composant
     le plus employé du produit : le choix entre eux avait cessé d'être une
     décision, et rien n'aurait dit à personne lequel prendre. Ses trois
     appelants passent sur `primary`, qui dit ce qu'il EST — l'action — plutôt
     que de quelle couleur il est peint. */
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
  //
  // Le rembourrage horizontal a gagné un demi-cran avec la gélule : les angles
  // arrondis rognent l'espace utile aux extrémités du libellé, ce que des coins
  // droits ne faisaient pas. La HAUTEUR ne bouge pas — c'est elle qui porte la
  // cible tactile, et elle est déjà au plancher.
  sm: 'min-h-11 px-3.5 text-label gap-1.5',
  md: 'min-h-11 px-4 text-body gap-2',
  /* `lg` GARDE SON REMBOURRAGE D'ORIGINE, et c'est la porte qui l'a exigé : à
     px-6, les deux boutons de l'appel à l'action de la vitrine débordaient leur
     rangée de 43 px à 1024 — une signature déjà tolérée jusqu'à 27, donc un
     défaut AGGRAVÉ et non nouveau. Le gabarit `lg` a déjà 20 px de chaque côté ;
     la gélule n'y manque pas d'air, contrairement aux deux plus petits. */
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
    /*
      LE BOUTON PASSE EN GÉLULE, et il est le SEUL à le faire.
      `rounded-md` reste la norme de tout ce qui se clique — champs, cellules de
      calendrier, segments de choix. Un bouton n'en est pas un cas parmi
      d'autres : c'est l'objet que l'œil cherche quand il veut agir, et la
      gélule est ce qui le sépare d'un champ de saisie de même hauteur. Dans le
      modèle suivi, tout le reste est rectangulaire à coins doux et seules les
      commandes sont pleinement arrondies — c'est cette distinction-là qu'on
      reprend, pas l'arrondi pour lui-même.
      Le rembourrage horizontal suit : une gélule mange ses angles, donc le
      texte a besoin de plus d'air qu'entre deux coins droits. Voir `SIZES`.
    */
    'inline-flex items-center justify-center rounded-full font-semibold no-underline',
    /*
      L'ÉTIQUETTE PEUT SE REPLIER, ET `whitespace-nowrap` L'EN EMPÊCHAIT.

      LE DÉFAUT, MESURÉ SUR UNE AUTRE MACHINE. `--font-sans` commence par
      `system-ui`, qui désigne un dessin différent par système : « Créer mon
      espace » rend 132,61 px ici et 146,14 px sur un exécuteur Ubuntu, où
      `system-ui` vaut DejaVu Sans. Onze pour cent. Avec `nowrap`, un bouton
      devient un ATOME INSÉCABLE : dès que son étiquette dépasse la place
      disponible, il ne se replie pas, il DÉBORDE de son conteneur.

      Quatre des cinq débordements que l'intégration continue a trouvés venaient
      de cette seule ligne — la rangée d'appel de la vitrine, le panneau final,
      la fiche d'un tableau à 320 px, la rangée d'actions d'un en-tête.

      CE QU'ON PERD, ET C'EST PEU : un bouton dont l'étiquette est longue peut
      désormais tenir sur deux lignes là où il n'y a pas la place pour une. Un
      bouton sur deux lignes reste lisible et cliquable ; un bouton qui sort de
      sa carte ne l'est pas. `min-h-11` tient la cible tactile dans les deux cas.

      CE QU'ON NE FAIT PAS : couper à l'intérieur d'un mot. Le repli se fait
      entre les mots, et une étiquette d'un seul mot n'offre rien à couper —
      c'est le même raisonnement que la barre basse, et il vaut ici aussi.
    */
    'cursor-pointer select-none',
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
  /**
   * Destination interne — la même branche que `Button`, et pour la même raison.
   *
   * `Button` sait rendre une ancre depuis `to` ; celui-ci ne savait rendre
   * qu'un `<button>`. Une commande ronde qui NAVIGUE devait donc s'écrire soit
   * en `<button onClick={navigate}>` — qui perd le clic milieu, le « ouvrir
   * dans un nouvel onglet », l'adresse au survol et l'annonce « lien » —, soit
   * en `Button` avec un libellé masqué, qui n'a ni la taille ni la forme des
   * autres commandes de la barre.
   *
   * Ni `href` ni l'état désactivé : aucun appelant n'en a besoin, et une
   * branche sans appelant se périme sans que personne l'apprenne.
   */
  to?: string
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 16,
  className,
  disabled,
  to,
  ...props
}: IconButtonProps) {
  const classes = cn(
    /* Rond, et non arrondi : un bouton icône est un bouton, donc une
       gélule — et une gélule carrée est un cercle. */
    'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full',
    'transition-colors duration-150 ease-out',
    VARIANTS[variant],
    disabled && ETEINT,
    className,
  )

  if (to) {
    /* Même conversion bornée que les branches « lien » de `Button`, et le même
       motif : le type restant décrit un `<button>`, quelques attributs n'ont
       pas de sens sur une ancre, et dupliquer la signature pour une branche
       coûterait plus que cette ligne. */
    const reste = props as unknown as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <Link to={to} aria-label={label} title={label} className={classes} {...reste}>
        <Icon name={icon} size={size} />
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={classes}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
