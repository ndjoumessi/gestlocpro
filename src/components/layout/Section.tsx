import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from './gouttiere'

/**
 * LE RYTHME EST UN VOCABULAIRE, pas un empilement d'utilitaires au cas par cas.
 *
 * Mesuré avant ce lot, à 1440 et 1920 px : les SEPT sections de la vitrine
 * portaient exactement 128 px de rembourrage en haut comme en bas, et 64 px
 * sous leur en-tête. Sept fois la même valeur. Une page ainsi réglée est propre
 * et muette : rien n'indique au regard où il en est, ni ce qui compte plus que
 * le reste, parce que TOUT est présenté avec la même insistance.
 *
 * Un rythme n'est pas l'absence de règle, c'est une règle à plusieurs temps.
 * Quatre suffisent, et chacun répond à une question sur le CONTENU — jamais sur
 * l'apparence :
 *
 *   `normal` — une étape du raisonnement. Le temps par défaut.
 *   `suite`  — cette section RÉPOND à celle d'avant ; les deux forment un seul
 *              mouvement. Seul le haut se resserre : le bas reste normal, sinon
 *              on aurait déplacé le mouvement au lieu de le lier.
 *   `serre`  — un appui, pas une étape. On y passe, on n'y décide pas.
 *   `ample`  — l'endroit où l'on décide. Le seul de la page.
 *
 * L'ÉCHELLE N'EST PAS INVENTÉE : elle prend les crans immédiatement voisins de
 * l'existant sur l'échelle d'espacement du cadre — 96 / 128 / 160 à `lg` — et
 * `normal` vaut exactement ce que les sept sections valaient. Le lot ne
 * redessine donc pas la page, il rend audible une différence entre ses parties.
 *
 * L'EN-TÊTE SUIT SON TEMPS. Une section resserrée qui garderait 64 px sous son
 * titre ne serait pas resserrée, elle serait rognée par les bords : le vide se
 * serait déplacé vers l'intérieur au lieu de disparaître.
 */
const RYTHMES = {
  normal: { section: 'py-20 sm:py-24 lg:py-32', entete: 'mb-12 sm:mb-16' },
  suite: { section: 'pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-32', entete: 'mb-12 sm:mb-16' },
  serre: { section: 'py-16 sm:py-20 lg:py-24', entete: 'mb-8 sm:mb-10' },
  ample: { section: 'py-24 sm:py-28 lg:py-40', entete: 'mb-12 sm:mb-16' },
} as const

export type Rythme = keyof typeof RYTHMES

export interface SectionProps {
  id?: string
  eyebrow?: string
  title?: string
  description?: string
  children: ReactNode
  tone?: 'canvas' | 'paper' | 'dark'
  /** Centre l'en-tête de section. */
  centered?: boolean
  /** Le temps que cette section occupe dans la page. Voir `RYTHMES`. */
  rythme?: Rythme
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
  rythme = 'normal',
  className,
}: SectionProps) {
  const temps = RYTHMES[rythme]

  return (
    <section
      id={id}
      // Marqué pour la mesure : une garde doit pouvoir vérifier au navigateur
      // que la page n'est pas retombée sur un seul temps — c'est l'état dont ce
      // lot la sort, et il ne se voit dans aucune capture prise section par
      // section. Il ne se voit qu'en les comparant.
      data-rythme={rythme}
      // `scroll-mt` compense l'en-tête collant : sans ça, l'ancre place le
      // titre de section sous la barre.
      // 192px de retrait laissaient des sections à moitié vides, qui se
      // lisaient comme inachevées plutôt que comme aérées. Le référentiel
      // prescrit ce vide pour des pages d'agence ; sur une page produit, où
      // l'on compare et où l'on décide, il faut de la respiration sans trous.
      className={cn('scroll-mt-20', temps.section, GOUTTIERE_LATERALE, TONES[tone], className)}
    >
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || description) && (
          <header
            className={cn(
              temps.entete,
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
