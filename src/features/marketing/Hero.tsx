import type { ReactNode } from 'react'
import { Button } from '@/components/primitives/Button'
import { StatusPill } from '@/components/primitives/StatusPill'
import { DeltaBadge } from '@/components/primitives/Badge'
import { MiniBarChart } from '@/components/primitives/Charts'
import { COLLECTIONS } from '@/data/portfolio'
import { useDates } from '@/lib/useDates'
import { Icon } from '@/components/primitives/Icon'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'

export function Hero() {
  const t = useT()
  const { money } = useCurrency()

  return (
    // Un halo doré flou occupait le coin haut droit. « No decorations » : il
    // ne portait rien et adoucissait précisément le contraste que ce style
    // cherche. Le fond est nu.
    <section className="relative bg-canvas px-5 pt-12 pb-24 sm:px-8 sm:pt-20 sm:pb-32 lg:pt-28 lg:pb-40">
      {/* Le titre prend toute la largeur, et le reste se range dessous : en
          deux colonnes, il n'avait que la moitié de l'écran et venait buter
          contre la carte d'aperçu.

          `items-center` et non `items-end` : le texte était épinglé au bas de
          la carte, ce qui creusait un vide entre le titre et la première ligne
          utile — le défaut le plus visible de la version précédente. */}
      <div className="relative mx-auto max-w-7xl">
        <p className="eyebrow flex items-center gap-2 text-gold-ink">
          <Icon name="globe" size={14} />
          {t('marketing.hero.eyebrow')}
        </p>

        <h1 className="display-xl mt-6 max-w-[18ch] text-balance">{t('marketing.hero.title')}</h1>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="max-w-[46ch] text-body-l text-pretty text-muted">
              {t('marketing.hero.subtitle')}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" to="/inscription" iconAfter="arrowRight">
                {t('marketing.hero.ctaPrimary')}
              </Button>
              <Button size="lg" variant="secondary" to="/demo" icon="grid">
                {t('marketing.hero.ctaSecondary')}
              </Button>
            </div>

            <p className="mt-5 flex items-center gap-2 text-body-s text-muted">
              <Icon name="checkCircle" size={15} className="text-gold-ink" />
              {t('marketing.hero.trust')}
            </p>

            {/* Les sélecteurs de langue et de devise vivaient aussi ici. Ils
                étaient les deuxièmes de quatre copies sur la même page —
                en-tête, hero, section internationale, pied de page. L'en-tête
                est collant : ils restent atteignables à tout moment, y compris
                avant le moindre défilement, ce qui était l'argument d'origine. */}
          </div>

          <HeroPreview money={money} t={t} />
        </div>
      </div>
    </section>
  )
}

/** Aperçu du tableau de bord : suit la devise choisie en temps réel. */
function HeroPreview({
  money,
  t,
}: {
  money: (amount: number, options?: { round?: boolean }) => string
  t: ReturnType<typeof useT>
}) {
  const d = useDates()

  // Les mêmes encaissements que le tableau de bord, et non des hauteurs
  // inventées : ce que le visiteur survole ici est ce qu'il retrouvera après
  // inscription.
  const bars = COLLECTIONS.map((month) => ({
    label: d.monthShort(month),
    value: month.rent + month.water + month.power,
  }))

  return (
    <div className="relative min-w-0">
      <div className="animate-rise rounded-2xl border border-divider bg-surface p-5 shadow-e3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-muted">{t('marketing.metrics.collected')}</p>
            {/* Le montant descend d'un cran sous `sm` : « 1 040 000 FCFA » en
                mono 32px ne se coupe pas et ne tient pas dans 375px. */}
            <p className="numeric mt-2 text-2xl leading-none font-medium sm:text-[2rem]">
              {money(1040000, { round: true })}
            </p>
          </div>
          {/* Couleurs de statut rétablies. Le motif retenu pour ce produit —
              une landing d'exploitation — les prescrit explicitement : « data-
              dense but scannable », vert / ambre / rouge. Sans elles, la carte
              perdait ce qu'elle est censée démontrer : qu'un coup d'œil suffit
              à situer un parc. La règle de l'accent unique valait pour le
              discours de la page, pas pour l'échantillon de produit qu'elle
              montre. */}
          <StatusPill tone="ok" size="sm">
            73 %
          </StatusPill>
        </div>

        <div className="mt-6">
          <MiniBarChart
            bars={bars}
            caption={t('app.dashboard.chartTitle')}
            openPeriodNote={t('app.dashboard.openMonth')}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-divider pt-5">
          <MiniStat
            label={t('marketing.metrics.occupancy')}
            value="83 %"
            note="10 / 12"
            delta={<DeltaBadge value={-8} suffix="pts" />}
          />
          <MiniStat
            label={t('marketing.metrics.overdue')}
            value={money(375000, { round: true })}
            note="3 locataires"
            delta={<DeltaBadge value={95000} invert />}
          />
        </div>
      </div>

      {/* Une vignette « Relances envoyées » flottait au-dessus de la carte.
          Elle a changé de place trois fois : sur les chiffres d'occupation,
          puis sur le graphe une fois celui-ci devenu interrogeable, puis sur la
          rangée de KPI. Un élément qui n'a de place nulle part n'a pas de
          place : les relances sont déjà nommées dans la grille des
          fonctionnalités, où elles ont leur propre entrée. « Elements
          minimal ». */}
    </div>
  )
}

function MiniStat({
  label,
  value,
  note,
  delta,
}: {
  label: string
  value: string
  note: string
  delta: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-muted">{label}</p>
      <p className="numeric mt-2 text-title-l font-medium">{value}</p>
      {/* Variation et effectif sur une seule ligne : empilés, ils faisaient
          quatre niveaux de lecture pour un chiffre. */}
      <p className="mt-2 flex flex-wrap items-center gap-2">
        {delta}
        <span className="text-body-s text-muted">{note}</span>
      </p>
    </div>
  )
}
