import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCIES, CURRENCY_DEFS, type CurrencyCode } from '@/currency/currencies'
import { Icon } from '@/components/primitives/Icon'

export interface CurrencySwitcherProps {
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * Sélecteur de devise.
 *
 * Un menu, et non un bouton qui fait défiler les devises au clic : cette
 * seconde forme demandait trois clics pour atteindre la dernière, sans jamais
 * montrer la liste. Le menu laisse aussi la place au libellé complet de chaque
 * devise — le seul symbole confondrait le dollar canadien et l'américain.
 */
export function CurrencySwitcher({ tone = 'light', className }: CurrencySwitcherProps) {
  const { currency, setCurrency, definition } = useCurrency()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const select = (code: CurrencyCode) => {
    setCurrency(code)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative shrink-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          // Hauteur alignée sur le sélecteur de langue, qui est un contrôle
          // groupé et fait donc 50px et non 44. Voir --size-control-group.
          'inline-flex min-h-(--size-control-group) cursor-pointer items-center gap-2 rounded-md border px-3',
          'text-body font-semibold transition-colors duration-150 ease-out',
          tone === 'dark'
            ? 'border-on-dark-border bg-on-dark-hover text-on-dark hover:bg-on-dark-active'
            : 'border-border bg-surface text-ink hover:border-ink',
        )}
      >
        {/* Le mot « Devise » est masqué visuellement sous sm : avec lui, le
            bouton, la bascule de langue et l'avatar ne tenaient pas sur une
            ligne dans la barre applicative d'un téléphone.
            `sr-only sm:not-sr-only` plutôt que `hidden sm:inline` + un second
            span `sr-only` : cette dernière combinaison laissait DEUX fois le
            libellé dans l'arbre d'accessibilité au-dessus de sm, annoncé
            « Devise Devise ». Ici l'élément est unique et change seulement de
            visibilité. */}
        <span
          className={cn(
            'eyebrow sr-only sm:not-sr-only',
            tone === 'dark' ? 'text-gold-on-dark' : 'text-gold-ink',
          )}
        >
          {t('common.currency')}
        </span>
        <span>{definition.label}</span>
        <Icon
          name="chevronDown"
          size={14}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('common.currency')}
          className={cn(
            'animate-pop absolute right-0 mt-1.5 min-w-52 overflow-hidden rounded-md',
            'border border-divider bg-surface p-1 shadow-e2',
          )}
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          {CURRENCIES.map((code) => {
            const def = CURRENCY_DEFS[code]
            const active = code === currency
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(code)}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5',
                    'text-left text-body transition-colors duration-150',
                    active ? 'bg-surface-sunken font-semibold text-ink' : 'text-ink hover:bg-surface-sunken',
                  )}
                >
                  <span className="w-4 shrink-0 text-gold-ink">
                    {active && <Icon name="check" size={14} strokeWidth={2.4} />}
                  </span>
                  <span className="flex-1">{def.label}</span>
                  <span className="text-caps text-muted">{code}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
