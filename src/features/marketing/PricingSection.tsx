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
      // `ample`, et c'est la SEULE de la page. Tout ce qui précède amène ici :
      // c'est le seul endroit où le visiteur manipule quelque chose — le
      // curseur d'unités, la bascule mensuel/annuel — et le seul où il décide.
      // Lui donner le même temps qu'aux six autres sections revenait à dire
      // qu'on peut la parcourir comme le reste.
      rythme="ample"
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

      {/*
        LES TROIS CARTES FONT UNE GRILLE, pas trois hauteurs libres.

        `items-start` laissait chacune à sa hauteur naturelle. Mesuré à 1440 px,
        la carte « Cabinet » finissait une centaine de pixels au-dessus de ses
        voisines : elle est la seule sans prix — « Sur devis » tient sur une
        ligne là où les deux autres empilent le montant, la mention mensuelle,
        la formule par unité et l'essai. Le palier le plus engageant se
        détachait donc du trio, et son bouton flottait seul en l'air.

        Sans `items-start`, les trois s'étirent à la hauteur de la rangée. Rien
        d'autre n'est à faire : la liste des fonctions porte déjà `flex-1`,
        c'est donc elle qui absorbe la place rendue, et les trois « Commencer »
        se retrouvent sur la même ligne. Un tableau comparatif se compare par
        ses lignes ; celle des boutons est la dernière et la plus décisive.

        Le décalage voulu de la carte mise en avant survit — `lg:-mt-3` la lève
        toujours de douze pixels au-dessus des deux autres, qu'elle dépasse
        désormais en haut sans les dépasser en bas.
      */}
      <div data-mesure="tarifs-grille" className="grid gap-4 lg:grid-cols-3">
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
              <p className="mt-1.5 min-h-10 text-body text-muted">
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
                    <p className="mt-2 text-body text-muted">
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
                      <p className="mt-1.5 text-body text-muted">
                        {t('marketing.pricing.roundingNote', {
                          exact: money(exact ?? 0, { round: Number.isInteger(exact) }),
                        })}
                      </p>
                    )}
                  </>
                )}

                {price !== null && (
                  <p className="mt-2 flex items-center gap-1.5 text-body text-muted">
                    <Icon name="checkCircle" size={14} />
                    {t('marketing.pricing.trial')}
                  </p>
                )}
              </div>

              {/* Le socle commun est énoncé une fois, en prose, plutôt que
                  répété en quatre coches identiques sur chaque carte. */}
              <p className="mt-5 flex items-start gap-2 text-body text-pretty text-muted">
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

              {/*
                « NOUS CONTACTER » NE MENAIT NULLE PART.

                Le palier sur devis — le plus cher, et le seul sans prix — offrait
                ce bouton vers `/#faq`. Deux défauts empilés. L'ancre d'abord :
                rien dans le dépôt ne recale la page sur le fragment d'une adresse,
                `grep -rn hash src/` ne rend pas une ligne, et le prospect
                atterrissait donc en haut de la page qu'il venait de quitter. Le
                fond ensuite : la FAQ ne porte aucun canal de contact — ni adresse,
                ni formulaire, ni numéro, et le dépôt entier n'en porte aucun. Le
                seul geste du palier le plus engageant promettait une conversation
                qui n'existe pas.

                Il mène désormais là où mènent les deux autres, et le dit avec le
                même mot. C'est aussi vrai pour Cabinet que pour Pro : aucun palier
                n'est facturé aujourd'hui, l'inscription ouvre le même espace, et
                « Sur devis » reste écrit juste au-dessus — le prospect n'apprend
                pas son prix en cliquant, il ne l'apprenait pas davantage avant.
                Fabriquer une adresse de contact aurait été le mensonge suivant.
              */}
              <Button
                className="mt-6"
                size="lg"
                fullWidth
                variant={popular ? 'primary' : 'secondary'}
                to="/inscription"
              >
                {t('marketing.pricing.cta')}
              </Button>
            </article>
          )
        })}
      </div>

      <p className="mx-auto mt-8 flex max-w-xl items-start justify-center gap-2 text-body text-muted">
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

      <p className="mt-1 text-body text-muted">{t('marketing.pricing.unitsHint')}</p>
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
    <li
      // Marqué pour la mesure : la règle « un seul signe pour l'exclusion » ne
      // veut rien dire s'il n'y a aucune exclusion à l'écran. C'est le marqueur
      // qui permet à la garde de vérifier qu'elle a bien quelque chose à
      // regarder avant de conclure qu'elle n'a rien vu.
      data-inclus={included ? 'oui' : 'non'}
      className={cn('flex items-start gap-2.5 text-body', !included && 'text-muted')}
    >
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
      {/*
        UN SEUL SIGNE POUR L'EXCLUSION, et la rature n'est pas le bon.

        Les lignes non incluses portaient une croix ET une barre de texte. Deux
        signes pour un message, dont un qui en dit un autre : une croix dit
        « non inclus dans ce palier », une rature dit « supprimé », « obsolète »,
        « annulé ». Sur une grille de tarifs, la seconde lecture est active — le
        prospect peut comprendre que la fonction a été RETIRÉE du produit, pas
        qu'elle vit un cran plus haut. C'est précisément le contraire de ce que
        cette grille doit lui faire comprendre, puisqu'elle vend la montée.

        La croix reste, et elle suffit : elle repose sur la FORME et non sur la
        couleur, ce qui la garde lisible en monochrome comme pour un daltonien.
        Le `text-muted` de la ligne l'appuie sans porter le sens à lui seul.
      */}
      <span>
        {label}
        {detail && <span className="ml-1.5 text-caps text-muted">{detail}</span>}
      </span>
    </li>
  )
}
