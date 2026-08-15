import { useMemo, useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { PaymentStatusPill, type PaymentStatus } from '@/components/primitives/StatusPill'
import { StatCard } from '@/components/primitives/Charts'
import { Button } from '@/components/primitives/Button'
import { useToast } from '@/components/primitives/Toast'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { CURRENT_TENANT_UNIT, KPIS, type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { RecordPaymentModal } from './RecordPaymentModal'
import { TenantScopeNote } from './TenantDashboard'

/** Part réglée simulée, dérivée du statut. */
function paidShare(unit: Unit): number {
  if (unit.status === 'paid') return unit.rent
  if (unit.status === 'partial') return Math.round(unit.rent * 0.53)
  return 0
}

const FILTERS: (PaymentStatus | 'all')[] = ['all', 'paid', 'partial', 'overdue']

export function Payments() {
  const t = useT()
  const { money } = useCurrency()
  const { notify } = useToast()
  const { role } = useRole()
  const { units } = usePortfolio()
  const isTenant = role === 'tenant'
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')
  const [payOpen, setPayOpen] = useState(false)

  // Le locataire ne voit que son bail. Le filtre est posé à la source du
  // tableau, pas sur l'affichage : ainsi les compteurs des onglets de statut et
  // les totaux se calculent eux aussi sur son seul périmètre.
  const leases = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status !== 'vacant' && (role !== 'tenant' || unit.id === CURRENT_TENANT_UNIT),
      ),
    [role, units],
  )
  const rows = useMemo(
    () => (filter === 'all' ? leases : leases.filter((unit) => unit.status === filter)),
    [leases, filter],
  )

  return (
    <>
      <PageHeader
        title={t('app.payments.title')}
        description={t('app.payments.subtitle')}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={() => notify(t('app.exported'))}>
              {t('app.exportStatement')}
            </Button>
            {/* Enregistrer un encaissement est un geste de gestion : le
                locataire consulte, il ne saisit pas. */}
            {!isTenant && (
              <Button icon="plus" onClick={() => setPayOpen(true)}>
                {t('app.recordPayment')}
              </Button>
            )}
          </>
        }
      />

      {isTenant ? (
        <TenantScopeNote />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('app.dashboard.expected')} value={money(KPIS.expected, { round: true })} />
          <StatCard
            label={t('app.dashboard.recoveryCollected')}
            value={money(KPIS.collected, { round: true })}
          />
          <StatCard
            label={t('app.dashboard.recoveryLate')}
            value={money(KPIS.late, { round: true })}
          />
        </div>
      )}

      <div role="group" aria-label={t('app.portfolio.status')} className="mt-6 mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((value) => {
          const active = filter === value
          const count =
            value === 'all' ? leases.length : leases.filter((u) => u.status === value).length
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3.5',
                'text-label font-semibold transition-colors duration-150',
                active
                  ? 'border-ink bg-ink text-on-dark'
                  : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
              )}
            >
              {value === 'all' ? t('app.payments.filterAll') : t(`status.${value}` as 'status.paid')}
              <span className={cn('numeric text-mono-label', active ? 'text-gold' : 'text-muted')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable<Unit>
        caption={t('app.payments.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        empty={
          <EmptyState
            icon="card"
            title={t('app.system.emptyTitle')}
            body={t('app.system.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => setFilter('all')}>
                {t('app.payments.filterAll')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (unit) => <span className="numeric font-medium">{unit.id}</span>,
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) => unit.tenant,
          },
          {
            key: 'due',
            header: t('app.payments.due'),
            numeric: true,
            hideOnMobile: true,
            render: (unit) => money(unit.rent, { round: true }),
          },
          {
            key: 'paid',
            header: t('app.payments.paid'),
            numeric: true,
            render: (unit) => money(paidShare(unit), { round: true }),
          },
          {
            key: 'balance',
            header: t('app.payments.balance'),
            numeric: true,
            render: (unit) => {
              const balance = unit.rent - paidShare(unit)
              // Un bail qui démarre affiche son loyer à venir, mais pas en
              // rouge : ce n'est pas un impayé, c'est une échéance future.
              const enRetard = unit.status === 'overdue' || unit.status === 'partial'
              return (
                <span
                  className={cn(
                    balance > 0 && enRetard ? 'font-medium text-danger' : 'text-muted',
                  )}
                >
                  {money(balance, { round: true })}
                </span>
              )
            },
          },
          {
            key: 'status',
            header: t('app.portfolio.status'),
            render: (unit) => (
              <div className="flex items-center gap-2">
                <PaymentStatusPill status={unit.status} size="sm" />
                {unit.overdueDays && (
                  <span className="numeric text-mono-label text-muted">+{unit.overdueDays} j</span>
                )}
              </div>
            ),
          },
        ]}
      />

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  )
}
