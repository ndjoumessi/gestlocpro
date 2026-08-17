import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'
import { useT } from '@/i18n/I18nProvider'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Barre d'actions collée en bas. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** `alertdialog` pour les confirmations destructives. */
  role?: 'dialog' | 'alertdialog'
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

/**
 * Modale avec piège de focus, restauration du focus à la fermeture,
 * fermeture par Échap et par clic sur le voile.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  /**
   * `onClose` retenu dans une référence, et NON dans les dépendances.
   *
   * L'effet ci-dessous ouvre la modale : il masque le défilement, place le
   * focus sur le premier champ, et — au nettoyage — le rend au bouton
   * d'ouverture. Le lier à l'identité de `onClose` le faisait rejouer à chaque
   * fois qu'un appelant recréait sa fonction, c'est-à-dire à chaque rendu pour
   * une fonction écrite en ligne.
   *
   * Conséquence observée, et coûteuse à trouver : un champ contrôlé n'acceptait
   * QU'UN caractère. La première frappe changeait l'état, le rendu recréait
   * `onClose`, l'effet se nettoyait et **rendait le focus au bouton
   * d'ouverture** — les frappes suivantes partaient dans le vide. Un champ non
   * contrôlé, lui, ne déclenchait aucun rendu et fonctionnait parfaitement :
   * c'est ce contraste qui a fini par désigner le coupable.
   *
   * La modale des locataires y échappait par chance : son `onClose` vient du
   * parent, qui ne se rend pas pendant la saisie. Une correction chez
   * l'appelant n'aurait donc protégé que lui, et le prochain appelant serait
   * retombé dedans.
   */
  const fermetureRef = useRef(onClose)
  fermetureRef.current = onClose
  const t = useT()

  const focusables = useCallback(() => {
    if (!dialogRef.current) return [] as HTMLElement[]
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
  }, [])

  useEffect(() => {
    if (!open) return

    openerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => {
      const nodes = focusables()
      // Le premier champ, à défaut le conteneur : jamais le bouton fermer.
      const target = nodes.find((el) => el.tagName !== 'BUTTON') ?? nodes[0]
      target?.focus()
    }, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        fermetureRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const nodes = focusables()
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, focusables])

  if (!open) return null

  const titleId = 'modal-title'
  const descId = 'modal-desc'

  return (
    <div
      // Sous `sm`, la modale est une feuille collée en bas, pleine largeur : en
      // portrait les insets latéraux valent 0, il n'y a donc rien à écarter, et
      // le bas est traité plus loin, sur les sections de la feuille elle-même.
      //
      // Dès `sm` elle se recentre — et c'est là que le paysage frappe : un
      // iPhone tourné mesure moins de `lg` mais bien plus que `sm`, donc il
      // prend cette branche, avec ses 24 px de marge contre 59 px d'encoche. La
      // boîte de dialogue passait sous l'encoche. `max()` : 24 px suffisent
      // partout ailleurs, l'inset ne prend le relais que quand il est plus
      // grand.
      className={cn(
        'fixed inset-0 flex items-end justify-center p-0 sm:items-center',
        'sm:pt-6 sm:pb-6',
        'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]',
      )}
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Le voile signale que l'arrière-plan est écarté, pas décoratif. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-scrim backdrop-blur-[3px]"
      />

      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
          'rounded-t-xl border border-divider bg-surface shadow-e3 sm:rounded-xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-divider p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="title-l">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-body-s text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>

        {/*
          La zone sûre du bas se pose sur la SECTION du bas, pas sur la feuille.
          Sur la feuille, le rembourrage aurait laissé apparaître une bande de
          `bg-surface` sous une barre d'actions qui, elle, est peinte en
          `bg-surface-sunken` : deux tons, un liseré parasite.

          Elle est donc portée par le pied quand il existe, et par le corps
          défilant sinon — sans quoi une modale sans actions laisserait sa
          dernière ligne sous la barre de gestes. `calc()` dans les deux cas :
          la section est peinte jusqu'au bord physique, son contenu s'en écarte.

          `sm:pb-*` remet la valeur nue : dès `sm` la boîte est recentrée et le
          conteneur l'a déjà écartée du bord. Sans ce retour, un dialogue de
          bureau traînerait un pied de 34 px de trop.
        */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 pt-5',
            footer ? 'pb-5' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5',
          )}
        >
          {children}
        </div>

        {footer && (
          <div
            className={cn(
              'flex flex-wrap justify-end gap-2 border-t border-divider bg-surface-sunken',
              'px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
