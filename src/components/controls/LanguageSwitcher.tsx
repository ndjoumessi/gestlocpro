import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales'

export interface LanguageSwitcherProps {
  /** `dark` pour les fonds sombres (sidebar, hero, pied de page). */
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * Bascule FR/EN.
 * Deux langues seulement : un segmenté vaut mieux qu'un menu déroulant —
 * un clic au lieu de deux, et l'état courant est lisible sans l'ouvrir.
 */
export function LanguageSwitcher({ tone = 'light', className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-md border p-0.5',
        tone === 'dark'
          ? 'border-on-dark-border bg-on-dark-hover'
          : 'border-border bg-surface',
        className,
      )}
    >
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => setLocale(code)}
            aria-pressed={active}
            title={LOCALE_LABELS[code].long}
            className={cn(
              // 44px de haut comme de large : cible tactile minimale tenue.
              'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm px-2.5',
              'text-caps font-semibold transition-colors duration-150 ease-out',
              active
                ? tone === 'dark'
                  ? 'bg-gold text-ink'
                  : 'bg-ink text-on-dark'
                : tone === 'dark'
                  ? 'text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark'
                  : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {LOCALE_LABELS[code].short}
            <span className="sr-only"> — {LOCALE_LABELS[code].long}</span>
          </button>
        )
      })}
    </div>
  )
}
