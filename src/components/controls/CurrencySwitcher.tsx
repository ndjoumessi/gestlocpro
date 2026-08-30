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
  const { currency, setCurrency, chargerLesCours } = useCurrency()
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
        onClick={() => {
          /* Les cours sont demandés À L'OUVERTURE, et non au choix : la liste
             doit savoir ce qu'elle peut offrir avant qu'on ait choisi, et le
             chemin par défaut — lire le parc dans sa monnaie — n'en paie
             toujours rien. */
          if (!open) chargerLesCours()
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        /* NOMMÉ SANS ÊTRE ÉTIQUETÉ. Le bouton portait le mot « Devise » en
           surtitre. Il est désormais posé par la ligne qui l'accueille
           (`ListeDeReglages`), et l'écrire ici le répétait à quinze pixels
           d'écart — « DEVISE / DEVISE Euro (€) ». Ce que le bouton MONTRE est
           la valeur choisie, qui se suffit : « Euro (€) » n'a pas besoin qu'on
           lui dise que c'est une devise. Le nom accessible, lui, reste — un
           lecteur d'écran n'a pas la ligne sous les yeux. */
        aria-label={t('common.currency')}
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
        {/*
          LE BOUTON PORTE CE QU'ON A DEMANDÉ, pas ce qui a pu être honoré.

          Il lisait la devise RENDUE. Quand les cours manquaient, l'écran
          retombait sur celle du parc et le bouton avec lui : la liste montrait
          « Dollar canadien » coché, le bouton affichait « FCFA », et le contrôle
          se contredisait à quinze pixels d'écart. Un seul état, celui de
          l'utilisateur ; ce qui n'a pas pu être fait se dit à côté, en toutes
          lettres — voir `MentionDeConversion`.
        */}
        <span>{CURRENCY_DEFS[currency].label}</span>
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
            // 52 → 64 : la ligne porte désormais un nom et non plus un code,
            // et « Dollar américain ($) » suivi de « USD » ne tenait pas dans
            // 208 px sans se couper.
            'animate-pop absolute right-0 mt-1.5 min-w-64 overflow-hidden rounded-md',
            'border border-divider bg-surface p-1 shadow-e2',
          )}
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          {CURRENCIES.map((code) => {
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
                  <span className="w-4 shrink-0 text-accent-ink">
                    {active && <Icon name="check" size={14} strokeWidth={2.4} />}
                  </span>
                  {/* LE NOM À GAUCHE, LE CODE À DROITE — et deux choses
                      différentes. La colonne de droite portait déjà le code
                      quand celle de gauche affichait « CAD ($) » : la ligne
                      l'écrivait deux fois et ne nommait rien, laissant
                      départager les deux dollars par trois lettres qu'il faut
                      déjà connaître. Le nom vient du dictionnaire, comme
                      partout ailleurs où une devise se lit en toutes lettres. */}
                  <span className="flex-1">
                    {t(`common.currencyNames.${code}` as 'common.currencyNames.CFA')}
                  </span>
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
