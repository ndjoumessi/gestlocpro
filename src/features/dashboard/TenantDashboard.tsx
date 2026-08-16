import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { StatCard } from '@/components/primitives/Charts'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import {
  CURRENT_TENANT_UNIT,
  TENANT_RECEIPTS,
  UTILITY_RATES,
  buildingById,
  readingForUnit,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * Espace locataire.
 *
 * Vue distincte du tableau de bord propriétaire, et non une variante filtrée :
 * un locataire ne cherche pas un taux d'occupation ni un encaissé consolidé, il
 * veut son échéance, ses quittances et l'état de ses signalements. Toutes les
 * données proviennent de sa seule unité — le parc n'est jamais interrogé.
 */
export function TenantDashboard() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { worksForUnit, depositForUnit, unitById } = usePortfolio()

  const unit = unitById(CURRENT_TENANT_UNIT)
  const building = unit ? buildingById(unit.buildingId) : undefined
  const deposit = depositForUnit(CURRENT_TENANT_UNIT)
  const reading = readingForUnit(CURRENT_TENANT_UNIT)
  const works = worksForUnit(CURRENT_TENANT_UNIT)
  const openWorks = works.filter((work) => work.status !== 'done')

  if (!unit) return null

  const water = reading?.waterCurrent === null || !reading ? null : reading.waterCurrent - reading.waterPrevious
  const power = reading?.powerCurrent === null || !reading ? null : reading.powerCurrent - reading.powerPrevious
  const rebilled =
    water === null || power === null ? null : water * UTILITY_RATES.water + power * UTILITY_RATES.power

  return (
    <>
      <PageHeader
        title={t('app.tenant.title')}
        description={t('app.tenant.subtitle')}
        actions={
          <Button icon="bell" to="/app/signalements">
            {t('app.tenant.contactManager')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('app.tenant.myUnit')}
          value={unit.id}
          unit={t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
          note={`${unit.surface} m² · ${building?.name ?? ''}`}
        />
        <StatCard
          label={t('app.tenant.nextDue')}
          value={money(unit.rent, { round: true })}
          note={t('app.dashboard.legendRent')}
        />
        <StatCard
          label={t('app.tenant.consumption')}
          value={rebilled === null ? '—' : money(rebilled, { round: true })}
          note={
            water === null || power === null
              ? t('app.meters.missing')
              : `${water} m³ · ${power} kWh`
          }
        />
        <StatCard
          label={t('app.tenant.deposit')}
          value={deposit ? money(deposit.held, { round: true }) : '—'}
          note={deposit ? t(`app.deposits.${deposit.status}` as 'app.deposits.held') : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card flush>
          <div className="p-4 sm:p-5">
            <CardHeader
              title={t('app.tenant.receipts')}
              level={2}
              className="mb-0"
              action={<PaymentStatusPill status={unit.status} size="sm" />}
            />
          </div>

          <ul className="divide-y divide-divider border-t border-divider">
            {TENANT_RECEIPTS.map((receipt) => (
              <li
                key={`${receipt.year}-${receipt.month}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 flex-1 text-body font-medium">
                  {d.monthYear(receipt)}
                </span>
                <span className="numeric text-body">{money(unit.rent, { round: true })}</span>
                <span className="font-mono text-mono-label text-muted">
                  {t('app.tenant.paidOn', {
                    date: d.dayMonth({ year: receipt.year, month: receipt.month, day: receipt.paidDay }),
                  })}
                </span>
                <Button variant="ghost" size="sm" icon="download">
                  {t('app.tenant.download')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={t('app.tenant.myWorks')} level={2} />
            {openWorks.length === 0 ? (
              <p className="text-body-s text-muted">{t('app.tenant.worksEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {openWorks.map((work) => (
                  <li key={work.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted">
                      <Icon name="wrench" size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body font-medium">{work.title}</p>
                      <p className="mt-0.5 font-mono text-mono-label text-muted">
                        {work.id} ·{' '}
                        {d.dayMonth(work.reportedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" to="/app/travaux" iconAfter="chevronRight" className="mt-4 -ml-3.5">
              {t('nav.works')}
            </Button>
          </Card>

          <Card tone="dark">
            <CardHeader title={t('app.tenant.manager')} level={2} />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-label font-semibold text-ink"
              >
                DF
              </span>
              <div className="min-w-0">
                <p className="text-body font-medium text-on-dark">{t('app.tenant.managerName')}</p>
                <p className="font-mono text-mono-label text-on-dark-faint">
                  {t('roles.manager.name')}
                </p>
              </div>
            </div>
            <Button variant="gold" to="/app/signalements" className="mt-4" fullWidth>
              {t('app.tenant.contactManager')}
            </Button>
          </Card>
        </div>
      </div>

      {/* La règle de confidentialité est dite à l'écran, pas seulement
          appliquée : le locataire doit savoir ce que son bailleur ne voit pas
          de lui, et inversement. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-divider bg-surface px-4 py-3 text-body-s text-muted">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-ok" />
        {t('app.tenant.privacyNote')}
      </p>
    </>
  )
}

/**
 * Écran refusé au locataire.
 *
 * Les entrées correspondantes sont retirées de sa navigation, mais les routes
 * restent atteignables à la main : sans ce garde, taper `/app/parc` affichait
 * tout le parc à un locataire. On explique le refus plutôt que de rediriger en
 * silence — une redirection muette passe pour un bug.
 */
export function TenantRestricted() {
  const t = useT()

  return (
    <>
      {/* Titre court en en-tête, explication dans l'encart : répéter la même
          phrase aux deux endroits la faisait lire deux fois pour rien. */}
      <PageHeader title={t('app.tenant.restrictedTitle')} />
      <EmptyState
        icon="lock"
        title={t('app.tenant.restricted')}
        body={t('app.tenant.restrictedHint')}
        action={
          <Button to="/app" icon="chevronLeft">
            {t('app.tenant.backToSpace')}
          </Button>
        }
      />
    </>
  )
}

/** Bandeau réutilisable rappelant le périmètre du locataire. */
export function TenantScopeNote() {
  const t = useT()
  return (
    <p className="mb-4 flex items-start gap-2 rounded-md border border-ok-border bg-ok-tint px-3.5 py-2.5 text-body-s text-ok">
      <StatusPill tone="ok" size="sm" icon="shield">
        {CURRENT_TENANT_UNIT}
      </StatusPill>
      {t('app.tenant.privacyNote')}
    </p>
  )
}
