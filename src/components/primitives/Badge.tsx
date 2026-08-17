import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'gold' | 'ok' | 'danger' | 'dark' | 'onDark'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  gold: 'bg-gold-tint text-gold-ink',
  ok: 'bg-ok-tint text-ok',
  danger: 'bg-danger text-on-dark',
  dark: 'bg-ink text-on-dark',
  onDark: 'bg-gold text-ink',
}

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** Étiquette compacte : compteurs de navigation, deltas, marqueurs. */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5',
        'numeric text-caps font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Delta chiffré. Le signe précède toujours la valeur : la couleur seule ne
 * porte pas l'information de sens.
 */
export function DeltaBadge({
  value,
  suffix,
  /** Inverse la lecture : pour un impayé, une hausse est une mauvaise nouvelle. */
  invert = false,
}: {
  value: number
  suffix?: string
  invert?: boolean
}) {
  const positive = value >= 0
  const good = invert ? !positive : positive
  const formatted = `${positive ? '+' : '−'}${new Intl.NumberFormat('fr-FR').format(Math.abs(value))}`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5',
        'numeric text-caps font-medium whitespace-nowrap',
        good ? 'bg-ok-tint text-ok' : 'bg-danger-tint text-danger',
      )}
    >
      {formatted}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}
