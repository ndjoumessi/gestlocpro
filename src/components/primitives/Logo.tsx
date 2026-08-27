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

const MARK_SIZES = { sm: 'size-6.5', md: 'size-8', lg: 'size-11' }
const WORD_SIZES = { sm: 'text-[15px]', md: 'text-[18px]', lg: 'text-[24px]' }

/**
 * ═══ LA MARQUE : QUATRE UNITÉS DANS UN CARRÉ, ET NON PLUS UNE LETTRE ═══
 *
 * Elle portait un « G » en Cormorant. Le commentaire qui l'accompagnait parlait
 * encore d'un « carré DORÉ » et de « l'or en texte sur fond clair » : l'accent
 * de marque est bleu depuis la refonte, et cette prose décrivait une couleur qui
 * n'existait plus nulle part dans le dépôt.
 *
 * La grille de quatre carrés vient du document de recherche de marque, où elle
 * est la direction RECOMMANDÉE, pour une raison qui se vérifie ici : c'est le
 * seul signe qui dise à la fois « plusieurs logements » et « états différents »,
 * les deux idées qui structurent le produit. Les opacités décroissantes — 1, 1,
 * 0,55, 0,22 — sont ce second sens ; sans elles, ce ne serait qu'une grille.
 *
 * ═══ LES COULEURS SONT DES JETONS, ET ELLES TOMBAIENT DÉJÀ JUSTE ═══
 *
 * Le tracé proposé peint son fond en `#2563EB` et ses carrés en `#FFFFFF`. Ce
 * sont, au caractère près, `--color-accent` et `--color-on-accent`. On garde donc
 * le conteneur existant — `rounded-md bg-accent text-on-accent` — et le SVG ne
 * porte QUE les quatre carrés, en `currentColor`. Deux conséquences : la marque
 * suit le thème sans le savoir, et le rayon de coin reste défini à un seul
 * endroit au lieu de vivre aussi dans un `rx` recopié.
 *
 * ═══ CE QUE CE N'EST PAS ═══
 *
 * Le document dont elle vient le dit lui-même : « ce sont des esquisses
 * vectorielles, pas des logos livrables ». Il reste, d'après lui, à vérifier
 * l'antériorité de marque, à faire dessiner la version finale, et à décliner en
 * favicon 16 px et en icône 1024 px. Rien de tout cela n'est fait ici.
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
          'flex shrink-0 items-center justify-center rounded-md bg-accent text-on-accent',
          MARK_SIZES[size],
        )}
      >
        {/* `size-[57%]` : la proportion du tracé d'origine — une grille de 24
            dans un carré de 42. Exprimée en pourcentage, elle survit aux trois
            tailles de marque sans qu'aucune ne redessine quoi que ce soit. */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-[57%]">
          <rect width="10" height="10" rx="2.6" />
          <rect x="14" width="10" height="10" rx="2.6" />
          <rect y="14" width="10" height="10" rx="2.6" opacity=".55" />
          <rect x="14" y="14" width="10" height="10" rx="2.6" opacity=".22" />
        </svg>
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
            GestLoc<span className={tone === 'dark' ? 'text-accent-on-dark' : 'text-accent-ink'}>Pro</span>
          </span>
          {caption && (
            <span
              className={cn(
                // Le nom du parc s'affiche dans la barre latérale du produit,
                // pas seulement sur une page de démonstration : il relève du
                // plancher de 12px comme le reste. `text-caps` porte
                // déjà taille, interligne et interlettrage — le `tracking`
                // arbitraire qui l'accompagnait faisait double emploi.
                'truncate text-caps',
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
