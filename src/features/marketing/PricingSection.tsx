import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { SegmentedControl } from '@/components/primitives/Choice'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { FEATURE_MATRIX, PLANS, planPrice, type FeatureValue } from './pricing'

export function PricingSection() {
  const t = useT()
  const { currency, money } = useCurrency()
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <Section
      id="pricing"
      eyebrow={t('marketing.pricing.eyebrow')}
      title={t('marketing.pricing.title')}
      description={t('marketing.pricing.subtitle')}
      centered
    >
      <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
        <SegmentedControl
          label={t('marketing.pricing.monthly')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'monthly', label: t('marketing.pricing.monthly') },
            {
              value: 'yearly',
              label: t('marketing.pricing.yearly'),
              badge: t('marketing.pricing.yearlySave'),
            },
          ]}
        />
        <CurrencySwitcher />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = planPrice(plan, currency, period)
          const popular = plan.popular

          return (
            <article
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-xl border p-6',
                popular
                  ? 'border-ink bg-surface shadow-e2 lg:-mt-3 lg:pb-8'
                  : 'border-divider bg-surface shadow-e1',
              )}
            >
              {popular && (
                <span className="absolute -top-3 left-6">
                  <Badge tone="dark">{t('marketing.pricing.popular')}</Badge>
                </span>
              )}

              <h3 className="font-sans text-title-l font-semibold">
                {t(`marketing.pricing.${plan.id}.name` as 'marketing.pricing.pro.name')}
              </h3>
              <p className="mt-1.5 min-h-10 text-body-s text-muted">
                {t(`marketing.pricing.${plan.id}.pitch` as 'marketing.pricing.pro.pitch')}
              </p>

              <div className="mt-5 border-y border-divider py-5">
                {price === null ? (
                  <p className="font-sans text-title-l font-semibold">
                    {t('marketing.pricing.quote')}
                  </p>
                ) : (
                  <>
                    {/* Un prix rond s'affiche sans décimales : « 13 $ » plutôt
                        que « 13,00 $ ». La remise annuelle, elle, tombe souvent
                        juste (10,40 $) et garde les siennes. */}
                    <p className="numeric text-[2.25rem] leading-none font-medium">
                      {money(price, { round: Number.isInteger(price) })}
                    </p>
                    <p className="mt-2 text-body-s text-muted">
                      {t('common.perMonth')}
                      {period === 'yearly' && ` · ${t('marketing.pricing.yearly').toLowerCase()}`}
                    </p>
                  </>
                )}

                <p className="mt-3 flex items-center gap-1.5 font-mono text-mono-label text-gold-ink">
                  <Icon name="building" size={13} />
                  {plan.units === 'unlimited'
                    ? t('marketing.pricing.unitsUnlimited')
                    : t('marketing.pricing.unitsUpTo', { count: plan.units })}
                </p>
              </div>

              <ul className="mt-5 flex flex-1 flex-col gap-3">
                {FEATURE_MATRIX.map((row) => (
                  <FeatureLine key={row.key} featureKey={row.key} value={row.values[plan.id]} />
                ))}
              </ul>

              <Button
                className="mt-6"
                size="lg"
                fullWidth
                variant={popular ? 'primary' : 'secondary'}
                to={price === null ? '/#faq' : '/inscription'}
              >
                {price === null ? t('marketing.pricing.ctaEnterprise') : t('marketing.pricing.cta')}
              </Button>
            </article>
          )
        })}
      </div>

      <p className="mx-auto mt-8 flex max-w-xl items-start justify-center gap-2 text-body-s text-muted">
        <Icon name="info" size={15} className="mt-0.5 shrink-0 text-gold-ink" />
        {t('marketing.pricing.currencyNote')}
      </p>
    </Section>
  )
}

function FeatureLine({ featureKey, value }: { featureKey: string; value: FeatureValue }) {
  const t = useT()
  const label = t(`marketing.pricing.features.${featureKey}` as 'marketing.pricing.features.rent')

  const included = value !== false
  let detail: string | null = null

  if (value === 'manual') detail = t('marketing.pricing.features.remindersManual')
  else if (value === 'auto') detail = t('marketing.pricing.features.remindersAuto')
  else if (value === 'email') detail = t('marketing.pricing.features.supportEmail')
  else if (value === 'priority') detail = t('marketing.pricing.features.supportPriority')
  else if (value === 'dedicated') detail = t('marketing.pricing.features.supportDedicated')
  else if (typeof value === 'string') detail = value

  return (
    <li className={cn('flex items-start gap-2.5 text-body', !included && 'text-muted')}>
      {/* Inclus / non inclus repose sur la forme de l'icône, pas sur sa couleur. */}
      <Icon
        name={included ? 'check' : 'close'}
        size={16}
        strokeWidth={included ? 2.2 : 1.7}
        className={cn('mt-0.5 shrink-0', included ? 'text-ok' : 'text-muted')}
      />
      <span className={cn(!included && 'line-through decoration-border-strong')}>
        {label}
        {detail && <span className="ml-1.5 font-mono text-mono-label text-muted">{detail}</span>}
      </span>
    </li>
  )
}
