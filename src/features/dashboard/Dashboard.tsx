import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { DeltaBadge } from '@/components/primitives/Badge'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { DonutChart, ProgressBar, StackedBarChart, StatCard } from '@/components/primitives/Charts'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { useDates } from '@/lib/useDates'
import { BUILDINGS, COLLECTIONS, KPIS } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { RecordPaymentModal } from './RecordPaymentModal'
import { TenantDashboard } from './TenantDashboard'

export function Dashboard() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { money, definition } = useCurrency()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { units, works, unitById } = usePortfolio()
  const [payOpen, setPayOpen] = useState(false)

  // Le locataire n'a pas une version filtrée de cet écran : il en a un autre.
  // Les indicateurs de parc — encaissé consolidé, taux d'occupation, impayés de
  // tous les baux — n'ont aucun sens pour lui, et les afficher revenait à lui
  // montrer la situation de ses voisins.
  if (role === 'tenant') return <TenantDashboard />

  const occupied = units.filter((unit) => unit.status !== 'vacant').length
  const vacant = units.length - occupied
  const occupancy = Math.round((occupied / units.length) * 100)
  const collectedShare = Math.round((KPIS.collected / KPIS.expected) * 100)
  const overdue = units.filter((unit) => unit.status === 'overdue')
  const maxOverdueDays = Math.max(...overdue.map((unit) => unit.overdueDays ?? 0))

  const title =
    role === 'owner'
      ? t('app.dashboard.titleOwner')
      : role === 'manager'
        ? t('app.dashboard.titleManager')
        : t('app.dashboard.titleTenant')

  // Les arbitrages en attente : ce que le propriétaire doit trancher.
  const decisions = works.filter((work) => work.status === 'quoted')

  return (
    <>
      <PageHeader
        title={title}
        description={t('app.dashboard.subtitle', {
          buildings: BUILDINGS.length,
          units: units.length,
          currency: definition.label,
        })}
        actions={
          <>
            {/* Le tableau de bord exporte ce que porte son graphique : les
                douze mois d'encaissements, ventilés comme la légende. */}
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                exportCsv({
                  name: t('app.files.collections'),
                  // Les montants sortent en nombres, la devise est nommée une
                  // fois par en-tête : un tableur doit pouvoir sommer la
                  // colonne, ce que « 1 010 000 FCFA » interdit.
                  headers: [
                    t('app.period'),
                    csvMoney.header(t('app.dashboard.legendRent')),
                    csvMoney.header(t('app.dashboard.legendWater')),
                    csvMoney.header(t('app.dashboard.legendPower')),
                    csvMoney.header(t('app.total')),
                  ],
                  rows: COLLECTIONS.map((month) => [
                    d.monthYear(month),
                    csvMoney.amount(month.rent),
                    csvMoney.amount(month.water),
                    csvMoney.amount(month.power),
                    csvMoney.amount(month.rent + month.water + month.power),
                  ]),
                })
              }
            >
              {t('app.exportStatement')}
            </Button>
            <Button icon="plus" onClick={() => setPayOpen(true)}>
              {t('app.recordPayment')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('app.dashboard.expected')}
          value={money(KPIS.expected, { round: true })}
          delta={<DeltaBadge value={KPIS.expectedDelta} />}
          note={t('app.dashboard.activeLeases', { count: occupied })}
        />
        <StatCard
          label={t('app.dashboard.collected')}
          value={money(KPIS.collected, { round: true })}
          note={t('app.dashboard.collectedShare', { percent: collectedShare })}
        />
        <StatCard
          label={t('app.dashboard.outstanding')}
          value={money(KPIS.outstanding, { round: true })}
          delta={<DeltaBadge value={KPIS.outstandingDelta} invert />}
          note={t('app.dashboard.overdueTenants', {
            count: overdue.length,
            days: maxOverdueDays,
          })}
        />
        <StatCard
          label={t('app.dashboard.occupancy')}
          value={`${occupancy}`}
          unit="%"
          delta={<DeltaBadge value={KPIS.occupancyDelta} suffix="pts" />}
          note={t('app.dashboard.vacantUnits', { count: vacant })}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={t('app.dashboard.chartTitle')} level={2} />
          {/* La légende répétait le titre visible : un lecteur d'écran
              entendait « Collections over 12 months » deux fois de suite. Elle
              porte maintenant ce que le titre ne dit pas — la nature du
              tableau, qui est l'équivalent textuel du graphique. */}
          <StackedBarChart
            caption={t('app.dashboard.chartTableCaption')}
            target={KPIS.expected}
            targetLabel={t('app.dashboard.expected')}
            seriesLabels={{
              rent: t('app.dashboard.legendRent'),
              water: t('app.dashboard.legendWater'),
              power: t('app.dashboard.legendPower'),
            }}
            bars={COLLECTIONS.map((month) => ({
              label: d.monthShort(month),
              segments: [
                { key: 'rent', value: month.rent },
                { key: 'water', value: month.water },
                { key: 'power', value: month.power },
              ],
            }))}
          />
          <p className="mt-4 border-t border-divider pt-4 text-body-s text-muted">
            {t('app.dashboard.chartNote')}
          </p>
        </Card>

        <Card>
          <CardHeader title={t('app.dashboard.recoveryTitle')} level={2} />
          <DonutChart
            caption={t('app.dashboard.recoveryTableCaption')}
            centerValue={`${collectedShare} %`}
            centerLabel={t('app.dashboard.recoveryCollected')}
            slices={[
              {
                key: 'paid',
                label: t('app.dashboard.recoveryCollected'),
                value: KPIS.collected,
                color: 'var(--color-ok)',
              },
              {
                key: 'partial',
                label: t('app.dashboard.recoveryPartial'),
                // `--color-warn` et non `--color-gold` : l'or de marque ne
                // tient que 2,87:1 sur blanc, sous le seuil d'une donnée.
                value: KPIS.partial,
                color: 'var(--color-warn)',
              },
              {
                key: 'late',
                label: t('app.dashboard.recoveryLate'),
                value: KPIS.late,
                color: 'var(--color-danger)',
              },
            ]}
          />

          <div className="mt-6 flex flex-col gap-3 border-t border-divider pt-5">
            <p className="eyebrow text-muted">{t('app.dashboard.rebilled')}</p>
            <ProgressBar label={t('app.dashboard.legendWater')} value={KPIS.waterRebilled} />
            <ProgressBar label={t('app.dashboard.legendPower')} value={KPIS.powerRebilled} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('app.dashboard.decisionsTitle')} level={2} />
          {decisions.length === 0 ? (
            <p className="text-body-s text-muted">{t('app.dashboard.decisionsEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {decisions.map((work) => (
                <li key={work.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold-ink">
                    <Icon name="wrench" size={15} />
                  </span>
                  <div className="min-w-0">
                    {/* Deux natures d'intitulé cohabitent : une clé pour le jeu
                        de démonstration, un texte libre dès que le locataire
                        l'écrit. Sans ce point de passage, l'écran rendrait
                        `app.works.samples.undefined` — un défaut qui compile. */}
                    <p className="text-body font-medium">{workTitle(work, t)}</p>
                    <p className="mt-0.5 font-mono text-mono-label text-muted">
                      {/* Un signalement ne porte que l'identifiant technique de
                          l'unité : le libellé se relit depuis le parc. Afficher
                          `work.unitId` montrerait un uuid le jour où les données
                          viendront du serveur. */}
                      {unitById(work.unitId)?.label} · {work.id} ·{' '}
                      {work.amount ? money(work.amount, { round: true }) : t('app.works.noQuote')}
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

        <Card>
          <CardHeader title={t('app.dashboard.scheduleTitle')} level={2} />
          <ul className="flex flex-col gap-3">
            {units.filter((unit) => unit.status !== 'paid' && unit.status !== 'vacant')
              .slice(0, 4)
              .map((unit) => (
                <li key={unit.id} className="flex items-center gap-3">
                  <span className="numeric w-9 shrink-0 text-body-s font-medium">{unit.label}</span>
                  <span className="min-w-0 flex-1 truncate text-body-s text-muted">
                    {unit.tenant}
                  </span>
                  <PaymentStatusPill status={unit.status} size="sm" />
                </li>
              ))}
          </ul>
          <Button
            variant="ghost"
            to="/app/paiements"
            iconAfter="chevronRight"
            className="mt-4 -ml-3.5"
          >
            {t('nav.payments')}
          </Button>
        </Card>

        <Card tone="dark">
          <CardHeader title={t('app.dashboard.breakdownTitle')} level={2} />
          <ul className="flex flex-col gap-3">
            {BUILDINGS.map((building) => {
              // Compté sur l'état vivant, comme l'écran Parc. Cette carte
              // divisait encore `building.occupied / building.units`, deux
              // compteurs figés dans la constante : rattacher un locataire
              // faisait bouger le parc et pas cette liste. Un compteur se
              // compte, il ne se stocke pas.
              const inBuilding = units.filter((u) => u.buildingId === building.id)
              const occupees = inBuilding.filter((u) => u.status !== 'vacant').length
              const rate = inBuilding.length
                ? Math.round((occupees / inBuilding.length) * 100)
                : 0
              return (
                <li key={building.id}>
                  <Link
                    to="/app/parc"
                    className="flex items-center gap-3 rounded-md py-1 no-underline"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-on-dark">
                        {building.name}
                      </span>
                      <span className="font-mono text-mono-label text-on-dark-faint">
                        {building.district}
                      </span>
                    </span>
                    <StatusPill
                      tone={rate === 100 ? 'ok' : 'warn'}
                      size="sm"
                      icon={rate === 100 ? 'checkCircle' : 'info'}
                    >
                      {occupees}/{inBuilding.length}
                    </StatusPill>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  )
}
