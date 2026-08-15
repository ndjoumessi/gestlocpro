import { cn } from '@/lib/cn'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StatusPill } from '@/components/primitives/StatusPill'
import { DeltaBadge } from '@/components/primitives/Badge'
import { LanguageSwitcher } from '@/components/controls/LanguageSwitcher'
import { CurrencySwitcher } from '@/components/controls/CurrencySwitcher'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'

export function Hero() {
  const t = useT()
  const { money } = useCurrency()

  return (
    <section className="relative overflow-hidden bg-canvas px-5 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
      {/* Halo doré discret, purement décoratif. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-32 size-[38rem] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)' }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <p className="eyebrow flex items-center gap-2 text-gold-ink">
            <Icon name="globe" size={14} />
            {t('marketing.hero.eyebrow')}
          </p>

          <h1 className="display-xl mt-4 max-w-[15ch] text-balance">{t('marketing.hero.title')}</h1>

          <p className="mt-5 max-w-xl text-body-l text-pretty text-muted">
            {t('marketing.hero.subtitle')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" to="/inscription" iconAfter="arrowRight">
              {t('marketing.hero.ctaPrimary')}
            </Button>
            <Button size="lg" variant="secondary" to="/app" icon="grid">
              {t('marketing.hero.ctaSecondary')}
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-2 text-body-s text-muted">
            <Icon name="checkCircle" size={15} className="text-ok" />
            {t('marketing.hero.trust')}
          </p>

          {/* Les sélecteurs sont dans le hero, pas seulement dans l'en-tête :
              c'est la promesse internationale, elle doit être manipulable
              avant tout défilement.

              Les deux contrôles vivent dans leur propre rangée plutôt que de
              partager un `flex-wrap` avec le libellé : sur un écran de 375px,
              « Vos préférences d'affichage » consommait presque toute la
              largeur et renvoyait la devise sur une troisième ligne. Le libellé
              passe au-dessus sous `sm`, les deux sélecteurs restent ensemble. */}
          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <span className="eyebrow text-muted">{t('marketing.hero.settingsLabel')}</span>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>
          </div>
        </div>

        <HeroPreview money={money} t={t} />
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
  const bars = [62, 71, 58, 80, 74, 88, 69, 92, 78, 85, 73, 96]

  return (
    <div className="relative">
      <div className="animate-rise rounded-2xl border border-divider bg-surface p-5 shadow-e3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow text-muted">{t('marketing.metrics.collected')}</p>
            <p className="numeric mt-2 text-[2rem] leading-none font-medium">
              {money(1040000, { round: true })}
            </p>
          </div>
          <StatusPill tone="ok" size="sm">
            73 %
          </StatusPill>
        </div>

        {/* Barres décoratives : l'information chiffrée est dans les cartes. */}
        <div aria-hidden="true" className="mt-6 flex h-24 items-end gap-1.5">
          {bars.map((height, index) => (
            <span
              key={index}
              className={cn(
                'animate-grow-y flex-1 rounded-t-[3px]',
                index === bars.length - 1 ? 'bg-gold' : 'bg-ink/85',
              )}
              style={{ height: `${height}%`, animationDelay: `${index * 40}ms` }}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-divider pt-5">
          <MiniStat
            label={t('marketing.metrics.occupancy')}
            value="83 %"
            note="10/12"
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

      {/* Vignette flottante : rend concrètes les relances automatiques.
          Calée sur le graphe, qui est décoratif — plus bas elle recouvrait
          les chiffres d'occupation. */}
      <div className="on-dark absolute top-[46%] -left-6 hidden w-60 rounded-lg border border-on-dark-border bg-ink p-3.5 shadow-e3 lg:block">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold text-ink">
            <Icon name="bell" size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-label font-semibold text-on-dark">
              {t('marketing.metrics.reminders')}
            </p>
            <p className="font-mono text-mono-label text-on-dark-faint">J+1 · J+7 · J+15</p>
          </div>
        </div>
      </div>
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
  delta: React.ReactNode
}) {
  return (
    <div>
      <p className="eyebrow text-muted">{label}</p>
      <p className="numeric mt-1.5 text-title-l font-medium">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {delta}
        <span className="text-body-s text-muted">{note}</span>
      </div>
    </div>
  )
}
