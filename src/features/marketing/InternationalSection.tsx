import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { CURRENCIES, CURRENCY_DEFS } from '@/currency/currencies'
import { COUNTRIES } from '@/lib/countries'
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'

/**
 * Section internationale. Les jetons ne sont pas décoratifs : cliquer une
 * devise ou une langue l'applique à toute la page, ce qui démontre la
 * promesse au lieu de l'énoncer.
 */
export function InternationalSection() {
  const { t, locale, setLocale } = useI18n()
  const { currency, setCurrency } = useCurrency()

  return (
    <Section id="international" tone="paper">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <p className="eyebrow flex items-center gap-2 text-gold-ink">
            <Icon name="globe" size={14} />
            {t('marketing.international.eyebrow')}
          </p>
          <h2 className="display-m mt-3 text-balance">{t('marketing.international.title')}</h2>
          <p className="mt-4 text-body-l text-pretty text-muted">
            {t('marketing.international.body')}
          </p>
          <p className="mt-5 flex items-center gap-2 font-mono text-mono-label text-muted">
            <Icon name="check" size={14} className="text-ok" />
            {t('marketing.international.countries', { count: COUNTRIES.length })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-divider bg-surface p-5 shadow-e1">
            <h3 className="eyebrow font-sans text-muted">
              {t('marketing.international.currencies')}
            </h3>
            <ul className="mt-4 flex flex-col gap-1.5">
              {CURRENCIES.map((code) => {
                const active = code === currency
                return (
                  <li key={code}>
                    <button
                      type="button"
                      onClick={() => setCurrency(code)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3',
                        'text-left text-body transition-colors duration-150',
                        active
                          ? 'bg-ink font-semibold text-on-dark'
                          : 'text-ink hover:bg-surface-sunken',
                      )}
                    >
                      <span className={cn('w-4 shrink-0', active ? 'text-gold' : 'text-transparent')}>
                        <Icon name="check" size={14} strokeWidth={2.4} />
                      </span>
                      <span className="flex-1">{CURRENCY_DEFS[code].label}</span>
                      <span
                        className={cn(
                          'font-mono text-mono-label',
                          active ? 'text-on-dark-faint' : 'text-muted',
                        )}
                      >
                        {code}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-divider bg-surface p-5 shadow-e1">
            <h3 className="eyebrow font-sans text-muted">
              {t('marketing.international.languages')}
            </h3>
            <ul className="mt-4 flex flex-col gap-1.5">
              {LOCALES.map((code) => {
                const active = code === locale
                return (
                  <li key={code}>
                    <button
                      type="button"
                      onClick={() => setLocale(code)}
                      aria-pressed={active}
                      lang={code}
                      className={cn(
                        'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3',
                        'text-left text-body transition-colors duration-150',
                        active
                          ? 'bg-ink font-semibold text-on-dark'
                          : 'text-ink hover:bg-surface-sunken',
                      )}
                    >
                      <span className={cn('w-4 shrink-0', active ? 'text-gold' : 'text-transparent')}>
                        <Icon name="check" size={14} strokeWidth={2.4} />
                      </span>
                      <span className="flex-1">{LOCALE_LABELS[code].long}</span>
                      <span
                        className={cn(
                          'font-mono text-mono-label',
                          active ? 'text-on-dark-faint' : 'text-muted',
                        )}
                      >
                        {LOCALE_LABELS[code].short}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  )
}
