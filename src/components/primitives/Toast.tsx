import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Icon, type IconName } from './Icon'
import { IconButton } from './Button'

export type ToastTone = 'neutral' | 'ok' | 'danger'

interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: ToastTone; action?: Toast['action'] }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 4500

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: 'info',
  ok: 'checkCircle',
  danger: 'alert',
}

const TONE_ACCENT: Record<ToastTone, string> = {
  neutral: 'text-accent',
  ok: 'text-ok',
  danger: 'text-danger',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback<ToastContextValue['notify']>((message, options) => {
    const id = nextId.current++
    setToasts((current) => [
      ...current.slice(-2),
      { id, message, tone: options?.tone ?? 'neutral', action: options?.action },
    ])
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `polite` : annoncé sans voler le focus de l'utilisateur. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        // `max(base, env(…))` et non `calc(base + env(…))` : le toast FLOTTE,
        // rien n'est peint jusqu'au bord. L'inset porte déjà la garde qu'il
        // faut contre la barre de gestes ; l'additionner propulserait une
        // notification passagère 50 px au-dessus du contenu, sur des écrans qui
        // n'en ont pas à donner. Le bandeau de version, lui, est peint et prend
        // l'addition — voir `BandeauVersion.tsx`.
        //
        // Le rembourrage de base est ÉCRIT DANS le `max()` plutôt que laissé à
        // un `p-4` qu'on surchargerait : c'est la seule forme qui ne dépende
        // pas de l'ordre de tri des utilitaires Tailwind, et la seule où l'on
        // voit d'un coup d'œil que l'appareil sans encoche garde ses 16 px.
        //
        // Les deux côtés latéraux sont traités, pas seulement le bas : en
        // paysage l'encoche mord à gauche OU à droite selon le sens de
        // rotation, et le toast passe à droite dès `sm`.
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2',
          'pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]',
          'sm:items-end sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          'sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]',
        )}
        style={{ zIndex: 'var(--z-toast)' }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Un message qui s'efface tout seul a besoin d'une échappatoire.
 *
 * Trois manques, et trois réponses distinctes :
 *
 *  - PAS de bouton de fermeture — corrigé. C'est le minimum : sans lui, un
 *    message reste 4,5 s quoi qu'il arrive, et l'action qu'il propose disparaît
 *    sous les doigts de qui la vise. Le bouton NE PREND PAS le focus à
 *    l'apparition : la région reste `polite`, une notification s'annonce, elle
 *    n'interrompt pas. Un focus volé arracherait le curseur du champ en cours
 *    de saisie — plus grave que le message manqué.
 *
 *  - PAS de pause au survol ni au focus — corrigé aussi, et pour une raison
 *    plus dure que le confort de lecture : la minuterie DÉMONTE l'élément qui
 *    porte le focus. Qui tabule jusqu'au bouton « Annuler » d'un toast le voit
 *    s'évaporer et retombe au `body`, donc en tête de document. Le survol suit
 *    la même règle par symétrie, et parce que le geste « je pose le pointeur
 *    dessus pour finir de lire » est universel. Le marché est tactile et le
 *    survol y est rare, mais il ne coûte rien de plus que le focus, qui, lui,
 *    est indispensable.
 *
 *  - PAS d'Échap — DÉLIBÉRÉMENT laissé de côté. Échap appartient à ce qui
 *    retient : une fenêtre modale, la liste ouverte d'un `Combobox`. Un toast
 *    ne retient rien, ne prend pas le focus et se superpose justement à ces
 *    éléments-là. Y accrocher un écouteur global de touches ferait fermer le
 *    toast au lieu de la fenêtre modale que l'utilisateur visait — on
 *    échangerait un message perdu contre un geste détourné.
 */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const t = useT()
  const [suspendu, setSuspendu] = useState(false)

  useEffect(() => {
    if (suspendu) return
    const timer = window.setTimeout(onDismiss, DURATION)
    return () => window.clearTimeout(timer)
  }, [onDismiss, suspendu])

  return (
    <div
      data-toast
      onMouseEnter={() => setSuspendu(true)}
      onMouseLeave={() => setSuspendu(false)}
      // `onFocus`/`onBlur` et non `onFocusIn`/`onFocusOut` : en React, ces deux
      // événements-là remontent déjà depuis les boutons enfants.
      onFocus={() => setSuspendu(true)}
      onBlur={() => setSuspendu(false)}
      className={cn(
        'animate-rise on-dark pointer-events-auto flex w-full max-w-sm items-start gap-3',
        'rounded-lg border border-on-dark-border bg-ink px-4 py-3 text-on-dark shadow-e3',
      )}
    >
      <Icon name={TONE_ICON[toast.tone]} size={17} className={cn('mt-0.5', TONE_ACCENT[toast.tone])} />
      <p className="min-w-0 flex-1 text-body">{toast.message}</p>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          /*
            `-my-3` avec `min-h-11` : la cible fait 44 px, et le toast ne grandit
            pas d'un pixel. Le rembourrage vertical du toast vaut douze de chaque
            côté ; la marge négative y loge la hauteur excédentaire du bouton, dont
            la boîte de marge retombe alors sous celle du message. Un doigt vise
            44 px, l'œil voit la ligne de texte qu'il voyait.
          */
          className="-my-3 inline-flex min-h-11 cursor-pointer items-center rounded-sm px-1 text-label font-semibold text-accent-on-dark underline underline-offset-2 hover:text-accent"
        >
          {toast.action.label}
        </button>
      )}

      {/* `IconButton` plutôt qu'un bouton sur mesure : il porte déjà la cible
          tactile de 44 px, que ce marché ne peut pas se permettre de rater sur
          la seule sortie du message. Les marges négatives la reprennent sur le
          rembourrage du toast pour ne pas le faire enfler.

          `onDark` et non la variante fantôme par défaut : celle-ci peint
          `bg-transparent`, et la bascule `.on-dark` de `tokens.css` s'arrête
          délibérément à la première surface rencontrée — `:not([class*='bg-'])`
          — pour ne pas repeindre en blanc le libellé d'un bouton doré. Son
          `text-ink` serait donc resté encre sombre sur l'encre du toast :
          une croix invisible. La variante sombre porte sa propre couleur. */}
      <IconButton
        icon="close"
        variant="onDark"
        label={t('common.closeNotification')}
        onClick={onDismiss}
        className="-my-1.5 -mr-2 shrink-0"
      />
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return context
}
