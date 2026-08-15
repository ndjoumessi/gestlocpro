import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { controlClasses } from './Field'
import { Icon, type IconName } from './Icon'
import { useT } from '@/i18n/I18nProvider'
import { scorePassword } from '@/features/auth/validation'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  icon?: IconName
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, icon, className, ...props },
  ref,
) {
  if (!icon) {
    return <input ref={ref} className={controlClasses(invalid, className)} {...props} />
  }

  return (
    <div className="relative">
      <Icon
        name={icon}
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input ref={ref} className={controlClasses(invalid, cn('pl-9.5', className))} {...props} />
    </div>
  )
})

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  invalid?: boolean
}

/** Champ mot de passe avec bascule d'affichage. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ invalid, className, ...props }, ref) {
    const [visible, setVisible] = useState(false)
    const t = useT()

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={controlClasses(invalid, cn('pr-12', className))}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
          aria-pressed={visible}
          className={cn(
            'absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 cursor-pointer',
            'items-center justify-center rounded-md text-muted',
            'transition-colors duration-150 hover:bg-surface-sunken hover:text-ink',
          )}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={17} />
        </button>
      </div>
    )
  },
)

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlClasses(invalid, cn('cursor-pointer appearance-none pr-10', className)))}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={controlClasses(invalid, cn('min-h-24 resize-y', className))}
      {...props}
    />
  )
})

/**
 * Jauge de robustesse du mot de passe.
 * Le niveau est annoncé en toutes lettres : la couleur ne suffit pas.
 */
export function PasswordStrength({ value }: { value: string }) {
  const t = useT()
  const score = scorePassword(value)

  if (!value) return null

  const levels = [
    { label: t('auth.strength.weak'), tone: 'bg-danger', text: 'text-danger' },
    { label: t('auth.strength.fair'), tone: 'bg-warn', text: 'text-warn' },
    { label: t('auth.strength.good'), tone: 'bg-ok', text: 'text-ok' },
    { label: t('auth.strength.strong'), tone: 'bg-ok', text: 'text-ok' },
  ]
  const level = levels[score]

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i <= score ? level.tone : 'bg-border',
            )}
          />
        ))}
      </div>
      <span className={cn('text-mono-label font-mono font-medium', level.text)}>{level.label}</span>
    </div>
  )
}
