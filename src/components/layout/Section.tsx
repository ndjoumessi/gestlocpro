import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionProps {
  id?: string
  eyebrow?: string
  title?: string
  description?: string
  children: ReactNode
  tone?: 'canvas' | 'paper' | 'dark'
  /** Centre l'en-tête de section. */
  centered?: boolean
  className?: string
}

const TONES = {
  canvas: 'bg-canvas',
  paper: 'bg-paper',
  dark: 'bg-ink text-on-dark on-dark',
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  tone = 'canvas',
  centered,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      // `scroll-mt` compense l'en-tête collant : sans ça, l'ancre place le
      // titre de section sous la barre.
      className={cn('scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24', TONES[tone], className)}
    >
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || description) && (
          <header className={cn('mb-10 sm:mb-14', centered && 'mx-auto max-w-2xl text-center')}>
            {eyebrow && (
              <p className={cn('eyebrow', tone === 'dark' ? 'text-gold' : 'text-gold-ink')}>
                {eyebrow}
              </p>
            )}
            {title && <h2 className="display-m mt-3 text-balance">{title}</h2>}
            {description && (
              <p
                className={cn(
                  'mt-4 text-body-l text-pretty text-muted',
                  !centered && 'max-w-2xl',
                )}
              >
                {description}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}
