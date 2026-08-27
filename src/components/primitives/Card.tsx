import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardTone = 'default' | 'sunken' | 'dark' | 'accent'

const TONES: Record<CardTone, string> = {
  default: 'bg-surface border-divider shadow-e1',
  sunken: 'bg-surface-sunken border-border',
  dark: 'bg-ink border-transparent text-on-dark on-dark',
  accent: 'bg-accent-tint border-accent-border',
  /* `plain` A ÉTÉ RETIRÉ, et c'est la garde des branches mortes qui l'a trouvé
     — pas l'œil. Une carte sans fond ni bordure n'est plus une carte : c'est un
     `<div>`, et le produit en écrivait un directement partout où il en voulait
     un. Le ton n'avait aucun appelant. */
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  /** Retire le rembourrage interne — pour les tableaux pleine largeur. */
  flush?: boolean
}

export function Card({ tone = 'default', flush, className, children, ...props }: CardProps) {
  return (
    <div
      /* `min-w-0` : une carte est un contenant, jamais une règle graduée.
         Posée dans une grille, elle hérite de `min-width: auto` et refuse donc
         de descendre sous la largeur intrinsèque de son contenu. La rangée de
         douze mois du graphe d'encaissements réclamait 402px à ce titre, dans
         une cellule qui en offrait 335 : la carte débordait, et le document
         avec elle — 19px de défilement horizontal sur un écran de 375, avant
         même qu'on touche à la typographie. Le plancher à 12px l'a porté à
         46px, ce qui a eu le mérite de rendre la fuite visible. */
      className={cn('min-w-0 rounded-lg border', TONES[tone], !flush && 'p-4 sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

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
