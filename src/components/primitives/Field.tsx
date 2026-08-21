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

      {/*
        L'AIDE RESTE QUAND L'ERREUR ARRIVE, et le contrat de ce fichier le
        promettait déjà en toutes lettres : « aide PERSISTANTE ».

        Elle disparaissait au moment précis où elle sert — celui où l'on vient
        de se tromper. Pire, `aria-describedby` continuait de la citer : le
        champ désignait un identifiant ABSENT du DOM, et un lecteur d'écran
        n'annonçait donc ni l'aide, ni parfois l'erreur, selon qu'il abandonne
        ou poursuit la liste. Un appelant passe bien les deux au même champ —
        « Montant » de l'encaissement porte le montant dû en aide.

        L'ordre compte : l'aide d'abord, l'erreur ensuite et au plus près du
        champ. C'est celle qu'on vient de déclencher qui doit se lire en dernier.
      */}
      {hint && (
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
    // PAS de `focus:outline-none` ici. Il y était, et il annulait l'anneau de
    // focus de TOUS les champs du produit — y compris ceux de l'inscription.
    // Ce n'est pas une affaire de spécificité mais de COUCHES : `*:focus-visible`
    // est déclaré dans `@layer base`, l'utilitaire atterrit dans `@layer
    // utilities`, et une couche déclarée plus tard l'emporte quoi qu'il arrive.
    // Il ne restait qu'un changement de bordure de 1px, à 1,33:1 sur le fond du
    // champ. Le même piège est documenté vingt lignes plus bas dans `tokens.css`
    // pour la bascule `.on-dark` — la leçon y avait été tirée, pas ici.
    'hover:border-border-strong focus:border-ink',
    invalid ? 'border-danger bg-danger-tint/40' : 'border-border',
    'disabled:cursor-not-allowed disabled:opacity-45',
    'read-only:bg-surface-sunken read-only:text-muted',
    className,
  )
