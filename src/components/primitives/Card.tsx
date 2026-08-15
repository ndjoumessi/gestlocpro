import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardTone = 'default' | 'sunken' | 'dark' | 'gold' | 'plain'

const TONES: Record<CardTone, string> = {
  default: 'bg-surface border-divider shadow-e1',
  sunken: 'bg-surface-sunken border-border',
  dark: 'bg-ink border-transparent text-on-dark on-dark',
  gold: 'bg-gold-tint border-gold-border',
  plain: 'bg-transparent border-transparent',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  /** Retire le rembourrage interne — pour les tableaux pleine largeur. */
  flush?: boolean
}

export function Card({ tone = 'default', flush, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-lg border', TONES[tone], !flush && 'p-4 sm:p-5', className)}
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
        {eyebrow && <div className="eyebrow mb-1.5 text-muted">{eyebrow}</div>}
        <Heading className="font-sans text-title-m font-semibold text-balance">{title}</Heading>
        {description && <p className="mt-1 text-body-s text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
