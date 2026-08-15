import { cn } from '@/lib/cn'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

export interface StepperProps {
  steps: string[]
  /** Index de l'étape courante, à partir de 0. */
  current: number
}

/**
 * Fil d'étapes.
 *
 * L'état de chaque étape passe par trois canaux : la forme (coche pour une
 * étape faite, numéro sinon), la couleur, et `aria-current` pour les lecteurs
 * d'écran. La ligne de résumé « Étape 2 sur 4 » reste affichée sur mobile, où
 * les libellés sont masqués faute de place.
 */
export function Stepper({ steps, current }: StepperProps) {
  const t = useT()

  return (
    <nav aria-label={t('auth.signup.title')} className="mb-8">
      <p className="eyebrow mb-3 text-muted sm:hidden">
        {t('auth.signup.stepOf', { current: current + 1, total: steps.length })}
      </p>

      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((label, index) => {
          const done = index < current
          const active = index === current

          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  'font-mono text-mono-label font-semibold transition-colors duration-200',
                  done && 'bg-ok text-on-dark',
                  active && 'bg-ink text-on-dark',
                  !done && !active && 'border border-border-strong bg-surface text-muted',
                )}
              >
                {done ? <Icon name="check" size={13} strokeWidth={2.6} /> : index + 1}
              </span>

              <span
                className={cn(
                  'hidden truncate text-label sm:block',
                  active ? 'font-semibold text-ink' : 'text-muted',
                )}
              >
                {label}
              </span>

              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px min-w-3 flex-1 transition-colors duration-200',
                    done ? 'bg-ok' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
