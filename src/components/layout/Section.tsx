import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'

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
      // 192px de retrait laissaient des sections à moitié vides, qui se
      // lisaient comme inachevées plutôt que comme aérées. Le référentiel
      // prescrit ce vide pour des pages d'agence ; sur une page produit, où
      // l'on compare et où l'on décide, il faut de la respiration sans trous.
      className={cn(
        'scroll-mt-20 py-20 sm:py-24 lg:py-32',
        GOUTTIERE_LATERALE,
        TONES[tone],
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || description) && (
          <header
            className={cn(
              'mb-12 sm:mb-16',
              centered
                ? 'mx-auto max-w-2xl text-center'
                : // En-tête sur deux colonnes : le titre à gauche, la
                  // description en vis-à-vis. Empilés, ils laissaient la moitié
                  // droite de la section vide — c'est ce vide-là, et non le
                  // retrait, qui donnait l'impression d'une page non finie.
                  'grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16',
            )}
          >
            <div>
              {eyebrow && (
                <p className={cn('eyebrow', tone === 'dark' ? 'text-gold' : 'text-gold-ink')}>
                  {eyebrow}
                </p>
              )}
              {title && <h2 className="display-m mt-4 text-balance">{title}</h2>}
            </div>
            {description && (
              <p
                className={cn(
                  'text-body-l text-pretty text-muted',
                  // 60ch : la mesure haute de la plage lisible. Inter a une
                  // chasse plus étroite que Manrope, donc `max-w-2xl` laissait
                  // filer la ligne au-delà de 80 caractères.
                  centered ? 'mt-5' : 'max-w-[60ch] lg:pb-1.5',
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
