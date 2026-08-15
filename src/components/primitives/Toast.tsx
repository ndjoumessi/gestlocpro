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
import { Icon, type IconName } from './Icon'

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
  neutral: 'text-gold',
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
        className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        style={{ zIndex: 'var(--z-toast)' }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DURATION)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
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
          className="cursor-pointer rounded-sm px-1 text-label font-semibold text-gold-on-dark underline underline-offset-2 hover:text-gold"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return context
}
