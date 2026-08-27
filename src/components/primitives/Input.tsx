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
    /*
      LE PREMIER NIVEAU NOMME LE REFUS, PAS UNE QUALITÉ.

      Il disait « Faible ». Les quatre mots se lisaient alors comme une échelle
      de qualité — faible, moyen, bon, robuste — sur laquelle rien n'indiquait
      OÙ SE TROUVE LA BARRIÈRE. Or elle est nette : le score 0 vaut exactement
      « trop court », donc exactement « refusé » (voir `scorePassword`), et les
      trois autres niveaux sont acceptés.

      Un ambre qui veut dire « accepté, mais on peut mieux » se lit comme un
      avertissement, c'est-à-dire comme un refus qui n'ose pas se dire. En
      nommant le seul niveau bloquant par sa CAUSE, le rouge cesse d'être un
      degré et redevient une barrière — et l'ambre redevient ce qu'il est, un
      avis.
    */
    { label: t('auth.strength.tooShort'), tone: 'bg-danger', text: 'text-danger' },
    { label: t('auth.strength.fair'), tone: 'bg-warn', text: 'text-warn' },
    { label: t('auth.strength.good'), tone: 'bg-ok', text: 'text-ok' },
    { label: t('auth.strength.strong'), tone: 'bg-ok', text: 'text-ok' },
  ]
  const level = levels[score]

  return (
    /*
      LE NIVEAU SE DIT, et il ne se disait pas.

      Les quatre barres sont `aria-hidden`, et c'est juste : ce sont des formes,
      pas du texte. Mais le mot qui les traduit — « faible », « correct »,
      « bon », « fort » — était rendu SANS annonce, dans un élément inerte. Un
      lecteur d'écran n'apprenait donc jamais que le mot de passe qu'on tape est
      refusable, alors que c'est la seule information de tout ce composant.

      `aria-live="polite"` et non `assertive` : le niveau change au fil de la
      frappe, et une annonce impérieuse couperait la parole à chaque caractère.
      Poli, le lecteur attend une pause — donc au plus trois ou quatre annonces
      pour un mot de passe entier, jamais une par touche.
    */
    <div className="flex items-center gap-2.5" aria-live="polite">
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
      <span className={cn('text-caps font-medium', level.text)}>{level.label}</span>
    </div>
  )
}
