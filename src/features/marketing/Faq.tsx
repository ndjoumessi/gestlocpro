import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'

const QUESTIONS = ['one', 'two', 'three', 'four', 'five'] as const

/**
 * FAQ en `<details>` natifs : ouverture au clavier, indexables par les moteurs
 * de recherche et lisibles sans JavaScript. Aucun état React n'est nécessaire.
 */
export function Faq() {
  const t = useT()

  return (
    <Section id="faq" tone="paper" eyebrow={t('marketing.faq.eyebrow')} title={t('marketing.faq.title')} centered>
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map((key) => (
          <details
            key={key}
            className="group rounded-lg border border-divider bg-surface px-5 shadow-e1 open:shadow-e2"
          >
            <summary
              className={cn(
                'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4',
                'font-sans text-title-m font-semibold text-ink',
                'marker:content-none [&::-webkit-details-marker]:hidden',
              )}
            >
              {t(`marketing.faq.${key}.q` as 'marketing.faq.one.q')}
              <Icon
                name="chevronDown"
                size={18}
                className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="border-t border-divider py-4 text-body text-pretty text-muted">
              {t(`marketing.faq.${key}.a` as 'marketing.faq.one.a')}
            </p>
          </details>
        ))}
      </div>
    </Section>
  )
}
