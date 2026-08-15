import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

/** Le nom de marque ne se traduit pas — il ne se recopie pas non plus. */
const BRAND = 'GestLocPro'

export interface LogoProps {
  tone?: 'light' | 'dark'
  /** Masque le mot-symbole — pour la barre latérale repliée. */
  markOnly?: boolean
  /** Ligne d'appui sous le nom (nom du parc dans l'application). */
  caption?: string
  size?: 'sm' | 'md' | 'lg'
  to?: string
  className?: string
}

const MARK_SIZES = { sm: 'size-6.5 text-[15px]', md: 'size-8 text-[19px]', lg: 'size-11 text-[26px]' }
const WORD_SIZES = { sm: 'text-[15px]', md: 'text-[18px]', lg: 'text-[24px]' }

/**
 * Marque GestLocPro : un « G » en Cormorant dans un carré doré, suivi du
 * mot-symbole. Le carré doré porte de l'encre, jamais l'inverse — l'or en
 * texte sur fond clair ne passe pas le contraste.
 */
export function Logo({
  tone = 'light',
  markOnly,
  caption,
  size = 'md',
  to = '/',
  className,
}: LogoProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-gold font-display',
          'leading-none font-semibold text-ink',
          MARK_SIZES[size],
        )}
      >
        G
      </span>

      {!markOnly && (
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'font-sans leading-tight font-bold tracking-[0.02em]',
              WORD_SIZES[size],
              tone === 'dark' ? 'text-on-dark' : 'text-ink',
            )}
          >
            GestLoc<span className={tone === 'dark' ? 'text-gold' : 'text-gold-ink'}>Pro</span>
          </span>
          {caption && (
            <span
              className={cn(
                'truncate font-mono text-[10px] tracking-[0.06em]',
                tone === 'dark' ? 'text-on-dark-faint' : 'text-muted',
              )}
            >
              {caption}
            </span>
          )}
        </span>
      )}
    </>
  )

  const classes = cn('flex min-h-11 items-center gap-2.5 no-underline', className)

  if (!to) {
    return (
      <span className={classes}>
        {content}
        <span className="sr-only">{BRAND}</span>
      </span>
    )
  }

  return (
    <Link to={to} className={classes} aria-label={BRAND}>
      {content}
    </Link>
  )
}
