import { useId, useState } from 'react'
import { cn } from '@/lib/cn'
import { Section } from '@/components/layout/Section'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { SegmentedControl } from '@/components/primitives/Choice'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import {
  FEATURE_MATRIX,
  PLANS,
  UNITS_DEFAULT,
  UNITS_MAX,
  UNITS_MIN,
  exactPlanPrice,
  planPrice,
  priceIsRounded,
  type FeatureValue,
} from './pricing'

export function PricingSection() {
  const t = useT()
  const { currency, money } = useCurrency()
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [units, setUnits] = useState(UNITS_DEFAULT)

  return (
    <Section
      id="pricing"
      eyebrow={t('marketing.pricing.eyebrow')}
      title={t('marketing.pricing.title')}
      description={t('marketing.pricing.subtitle')}
      centered
    >
      <UnitSlider units={units} onChange={setUnits} />

      <div className="mt-8 mb-10 flex flex-wrap items-center justify-center gap-3">
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
          const price = planPrice(plan, currency, period, units)
          const exact = exactPlanPrice(plan, currency, period, units)
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

              <h3 className="title-l">
                {t(`marketing.pricing.${plan.id}.name` as 'marketing.pricing.pro.name')}
              </h3>
              <p className="mt-1.5 min-h-10 text-body-s text-muted">
                {t(`marketing.pricing.${plan.id}.pitch` as 'marketing.pricing.pro.pitch')}
              </p>

              <div className="mt-5 border-y border-divider py-5">
                {price === null || !plan.pricing ? (
                  <p className="title-l">
                    {t('marketing.pricing.quote')}
                  </p>
                ) : (
                  <>
                    {/* Un prix rond s'affiche sans décimales : « 13 $ » plutôt
                        que « 13,00 $ ». */}
                    <p className="numeric text-[2.25rem] leading-none font-medium">
                      {money(price, { round: Number.isInteger(price) })}
                    </p>
                    <p className="mt-2 text-body-s text-muted">
                      {t('common.perMonth')}
                      {period === 'yearly' && ` · ${t('marketing.pricing.yearly').toLowerCase()}`}
                    </p>

                    {/* La formule est affichée : le prix doit être vérifiable
                        par le prospect, pas seulement constaté. */}
                    <p className="mt-3 flex items-center gap-1.5 text-caps text-gold-ink">
                      <Icon name="building" size={13} />
                      {t('marketing.pricing.perUnitNote', {
                        base: money(plan.pricing.base[currency], {
                          round: Number.isInteger(plan.pricing.base[currency]),
                        }),
                        perUnit: money(plan.pricing.perUnit[currency]),
                      })}
                    </p>

                    {/* Signalé seulement quand l'écart existe : l'afficher sur
                        chaque carte en ferait un bruit qu'on cesse de lire, et
                        la mention perdrait justement sa valeur là où elle
                        compte. */}
                    {priceIsRounded(plan, currency, period, units) && (
                      <p className="mt-1.5 text-body-s text-muted">
                        {t('marketing.pricing.roundingNote', {
                          exact: money(exact ?? 0, { round: Number.isInteger(exact) }),
                        })}
                      </p>
                    )}
                  </>
                )}

                {price !== null && (
                  <p className="mt-2 flex items-center gap-1.5 text-body-s text-muted">
                    <Icon name="checkCircle" size={14} />
                    {t('marketing.pricing.trial')}
                  </p>
                )}
              </div>

              {/* Le socle commun est énoncé une fois, en prose, plutôt que
                  répété en quatre coches identiques sur chaque carte. */}
              <p className="mt-5 flex items-start gap-2 text-body-s text-pretty text-muted">
                <Icon
                  name="check"
                  size={14}
                  strokeWidth={2.2}
                  className="mt-0.5 shrink-0 text-gold-ink"
                />
                {t('marketing.pricing.allIncluded')}
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-divider pt-5">
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

/**
 * Sélecteur du nombre d'unités.
 *
 * Le prix se calcule à l'unité près : le prospect doit pouvoir lire SON prix,
 * pas celui d'un palier dans lequel il devine se ranger. Un `input[type=range]`
 * natif donne la navigation clavier par flèches et l'annonce de la valeur sans
 * code supplémentaire ; `aria-valuetext` remplace le nombre nu par « 12 unités »
 * à la lecture d'écran.
 */
function UnitSlider({ units, onChange }: { units: number; onChange: (n: number) => void }) {
  const t = useT()
  const id = useId()
  const atMax = units >= UNITS_MAX
  const progress = ((units - UNITS_MIN) / (UNITS_MAX - UNITS_MIN)) * 100

  return (
    <div className="mx-auto max-w-xl">
      <label htmlFor={id} className="block text-label font-semibold text-ink">
        {t('marketing.pricing.unitsSelector')}
      </label>

      <div className="mt-3 flex items-center gap-4">
        <input
          id={id}
          type="range"
          min={UNITS_MIN}
          max={UNITS_MAX}
          value={units}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={
            atMax
              ? t('marketing.pricing.unitsValueMax', { count: units })
              : t('marketing.pricing.unitsValue', { count: units })
          }
          className={cn(
            'h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent',
            // La piste est peinte en dégradé dur : la portion parcourue en or,
            // le reste en bordure. Deux préfixes, faute d'API commune.
            '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full',
            '[&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:size-5',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface',
            '[&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-e1',
            '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface',
            '[&::-moz-range-thumb]:bg-ink',
          )}
          style={{
            // Variable consommée par les deux pseudo-éléments de piste.
            backgroundImage: `linear-gradient(to right, var(--color-gold) ${progress}%, var(--color-border) ${progress}%)`,
            backgroundSize: '100% 6px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <output
          htmlFor={id}
          className="numeric w-24 shrink-0 text-right title-m"
        >
          {atMax
            ? t('marketing.pricing.unitsValueMax', { count: units })
            : t('marketing.pricing.unitsValue', { count: units })}
        </output>
      </div>

      <p className="mt-1 text-body-s text-muted">{t('marketing.pricing.unitsHint')}</p>
    </div>
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
      {/* Inclus / non inclus repose sur la forme de l'icône, pas sur sa
          couleur — ce qui rend le passage au monochrome sans conséquence pour
          la compréhension. Le vert a laissé place à l'encre : le style retenu
          n'admet qu'un seul accent, et sur cette page c'est l'or. */}
      <Icon
        name={included ? 'check' : 'close'}
        size={16}
        strokeWidth={included ? 2.2 : 1.7}
        className={cn('mt-0.5 shrink-0', included ? 'text-ink' : 'text-muted-soft')}
      />
      <span className={cn(!included && 'line-through decoration-border-strong')}>
        {label}
        {detail && <span className="ml-1.5 text-caps text-muted">{detail}</span>}
      </span>
    </li>
  )
}
