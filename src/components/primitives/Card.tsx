import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardTone = 'default' | 'sunken' | 'dark' | 'darkRaised' | 'accent'

/** Le niveau d'élévation — voir `elevation`. */
export type CardElevation = 'e1' | 'e2' | 'e3'

const TONES: Record<CardTone, string> = {
  default: 'bg-surface border-divider shadow-e1',
  sunken: 'bg-surface-sunken border-border',
  dark: 'bg-ink border-transparent text-on-dark on-dark',
  /* La carte sombre POSÉE SUR une section sombre. `dark` peint `--color-ink`,
     qui est déjà le fond d'une section en ton sombre : une carte y disparaîtrait
     dans son support. Celle-ci monte d'un cran sur `--color-ink-2` et prend une
     bordure de la famille inversée, ce qui la détache sans l'éclaircir. */
  darkRaised: 'bg-ink-2 border-on-dark-border text-on-dark on-dark',
  accent: 'bg-accent-tint border-accent-border',
  /* `plain` A ÉTÉ RETIRÉ, et c'est la garde des branches mortes qui l'a trouvé
     — pas l'œil. Une carte sans fond ni bordure n'est plus une carte : c'est un
     `<div>`, et le produit en écrivait un directement partout où il en voulait
     un. Le ton n'avait aucun appelant. */
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone
  /** Retire le rembourrage interne — pour les tableaux pleine largeur. */
  flush?: boolean
  /**
   * L'ÉLÉMENT RENDU, et il fallait le rendre réglable.
   *
   * `Card` ne savait produire qu'un `<div>`. Un audit a compté HUIT cartes de
   * vitrine qui la réimplémentaient à la main, et six d'entre elles ne pouvaient
   * PAS l'appeler : ce sont un `<article>`, un `<li>` dans un `<ol>`, un
   * `<details>`. Ce n'est pas du zèle sémantique — un `<div>` enfant direct
   * d'`<ol>` est du HTML invalide, et six cartes de fonctionnalité perdraient
   * leur rôle `article` pour un lecteur d'écran.
   *
   * Une primitive qu'on ne peut pas appeler sans casser sa page n'est pas une
   * primitive : c'est un exemple qu'on recopie.
   */
  as?: 'div' | 'article' | 'section' | 'li'
  /**
   * L'ÉLÉVATION, et pourquoi elle ne se passe pas par `className`.
   *
   * `cn` CONCATÈNE, il ne fusionne pas — ce n'est pas `tailwind-merge`, et son
   * en-tête le dit. Poser `shadow-e3` par-dessus le `shadow-e1` de la carte
   * laisse donc les DEUX classes dans le balisage, et c'est l'ordre d'ÉMISSION
   * de la feuille qui tranche. Il se trouve qu'il tranche dans le bon sens
   * aujourd'hui ; s'y fier, c'est écrire une règle morte à côté d'une vivante et
   * appeler ça une décision.
   *
   * Le même piège vaut, en pire, pour le rembourrage : `flush` plus une valeur
   * explicite est la seule façon sûre de le changer. Mesuré par l'audit —
   * `className="p-6"` sur une carte par défaut rend `p-4 p-6 sm:p-5`, et le
   * rembourrage TOMBE de 24 à 20 px au-delà de 640 px.
   */
  elevation?: CardElevation
}

const ELEVATIONS: Record<CardElevation, string> = {
  e1: 'shadow-e1',
  e2: 'shadow-e2',
  e3: 'shadow-e3',
}

/**
 * LA RÉFÉRENCE EST RELAYÉE, et l'absence se payait ailleurs.
 *
 * `Input`, `Select`, `Textarea` et `Button` relaient tous la leur depuis
 * toujours ; `Card` était la seule primitive de conteneur à l'avaler. Une
 * primitive qui ne relaie pas sa référence ne peut porter ni focus programmé,
 * ni mesure, ni détection de clic extérieur — c'est-à-dire rien de ce qu'un
 * panneau, une modale ou un menu réclament. On la recopie alors à la main, et
 * c'est ce que l'audit des huit cartes de vitrine a trouvé.
 *
 * `HTMLElement` et non `HTMLDivElement` : `as` accepte quatre balises, et un
 * `<li>` n'est pas un `<div>`. Le type le plus étroit qui les couvre toutes est
 * leur ancêtre commun.
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { tone = 'default', flush, as: balise = 'div', elevation, className, children, ...props },
  ref,
) {
  /* LA BALISE EST RAMENÉE À UNE SEULE, et c'est la conversion qui porte tout le
     polymorphisme.

     Laissée à son union — `'div' | 'article' | 'section' | 'li'` — JSX exige de
     la référence qu'elle satisfasse les QUATRE interfaces à la fois, donc leur
     INTERSECTION : `HTMLDivElement & HTMLLIElement & …`, qu'aucune référence
     réelle ne peut habiter. Mesuré : `Type '(instance: HTMLDivElement | null)
     => void' is not assignable to type 'string & ((instance: HTMLLIElement |
     null) => void)'`. L'union se retourne en intersection dès qu'elle passe en
     position de paramètre, et c'est ce retournement, pas la référence, qui est
     le problème.

     Le contrat public reste `HTMLElement` : c'est ce que l'appelant déclare, et
     c'est vrai des quatre balises. La conversion ne vaut qu'à l'intérieur. */
  const Element = balise as 'div'

  return (
    <Element
      ref={ref as React.Ref<HTMLDivElement>}
      /* `min-w-0` : une carte est un contenant, jamais une règle graduée.
         Posée dans une grille, elle hérite de `min-width: auto` et refuse donc
         de descendre sous la largeur intrinsèque de son contenu. La rangée de
         douze mois du graphe d'encaissements réclamait 402px à ce titre, dans
         une cellule qui en offrait 335 : la carte débordait, et le document
         avec elle — 19px de défilement horizontal sur un écran de 375, avant
         même qu'on touche à la typographie. Le plancher à 12px l'a porté à
         46px, ce qui a eu le mérite de rendre la fuite visible. */
      className={cn(
        'min-w-0 rounded-lg border',
        TONES[tone],
        !flush && 'p-4 sm:p-5',
        elevation && ELEVATIONS[elevation],
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  )
})

export interface CardHeaderProps {
  title: ReactNode
  /** Suréminence en mono au-dessus du titre. */
  eyebrow?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** Niveau du titre — préserve la hiérarchie h1→h6 de la page. */
  level?: 2 | 3 | 4
}

export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  className,
  level = 3,
}: CardHeaderProps) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {/* `break-words` pour la même raison que l'intitulé d'un indicateur, et
            la porte l'a exigé au même endroit du raisonnement : la gélule a
            élargi le bouton d'action de 2 px, la colonne du titre s'est
            resserrée d'autant, et « QUITTANCES » — un seul mot, en capitales
            interlettrées — a dépassé sa boîte de 3 px à 320. Aucun repli ne
            coupe un mot unique ; il faut l'autoriser explicitement. Le surtitre
            n'a pas de plafond de lignes : il est court par nature, et le rogner
            comme un intitulé de carte n'aurait servi aucun cas réel. */}
        {eyebrow && (
          <div className="eyebrow mb-1.5 hyphens-auto break-words text-muted">{eyebrow}</div>
        )}
        <Heading className="title-m text-balance">{title}</Heading>
        {description && <p className="mt-1 text-body text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
