import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { useT } from '@/i18n/I18nProvider'

export interface FieldProps {
  label: string
  /** Rendu avec l'`id`, `aria-describedby` et `aria-invalid` déjà câblés. */
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
  }) => ReactNode
  /** Texte d'aide persistant — pas un placeholder. */
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  className?: string
}

/**
 * Enveloppe de champ.
 *
 * Applique quatre règles d'un coup : label visible associé (jamais un
 * placeholder seul), aide persistante, erreur sous le champ et non en haut du
 * formulaire, et annonce de l'erreur via `role="alert"`.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required,
  optional,
  className,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const t = useT()

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> ({t('common.required')})</span>}
        {optional && (
          <span className="ml-1.5 font-normal text-muted">({t('common.optional')})</span>
        )}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="text-body-s text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-body-s font-medium text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  )
}

/** Styles partagés par input, select et textarea. */
export const controlClasses = (invalid?: boolean, className?: string) =>
  cn(
    'w-full rounded-md border bg-surface px-3 text-ink',
    // 16px en dessous de sm : évite le zoom automatique de Safari iOS au focus.
    'min-h-11 py-2.5 text-body-l sm:text-body',
    'placeholder:text-muted-soft',
    'transition-colors duration-150 ease-out',
    'hover:border-border-strong focus:border-ink focus:outline-none',
    invalid ? 'border-danger bg-danger-tint/40' : 'border-border',
    'disabled:cursor-not-allowed disabled:opacity-45',
    'read-only:bg-surface-sunken read-only:text-muted',
    className,
  )
