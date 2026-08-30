import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'danger' | 'dark'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  accent: 'bg-accent-tint text-accent-ink',
  ok: 'bg-ok-tint text-ok',
  // `text-on-danger` et non `text-on-dark` : le second est figé à blanc sous
  // `.on-dark`, où vit la pastille de la barre latérale, alors que le fond
  // s'éclaircit en thème sombre.
  danger: 'bg-danger text-on-danger',
  dark: 'bg-ink text-on-dark',
  /* `onDark` A ÉTÉ RETIRÉ, et son nom disait pourquoi il devait l'être : il
     valait `bg-accent text-on-accent` et désignait le CONTEXTE où il servait —
     une barre sombre — plutôt que ce qu'il PEINT. Les deux barres du produit
     sont passées au clair, il n'avait plus un seul appelant, et son nom était
     devenu doublement faux : ni sombre, ni employé. Un ton se nomme d'après sa
     couleur ou son rôle, jamais d'après le décor qui l'entourait le jour où on
     l'a écrit. */
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
