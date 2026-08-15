import { PageHeader } from '@/components/layout/AppShell'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { DEPOSITS, type Deposit } from '@/data/portfolio'

const TONE: Record<Deposit['status'], StatusTone> = {
  held: 'info',
  settling: 'warn',
  returned: 'ok',
}

export function Deposits() {
  const t = useT()
  const { money } = useCurrency()

  const totalHeld = DEPOSITS.reduce((sum, d) => sum + d.held, 0)
  const totalWithheld = DEPOSITS.reduce((sum, d) => sum + d.withheld, 0)

  return (
    <>
      <PageHeader title={t('app.deposits.title')} description={t('app.deposits.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('app.deposits.totalHeld')} value={money(totalHeld, { round: true })} />
        <StatCard label={t('app.deposits.withheld')} value={money(totalWithheld, { round: true })} />
        <StatCard
          label={t('app.deposits.balance')}
          value={money(totalHeld - totalWithheld, { round: true })}
        />
      </div>

      <div className="mt-6">
        <DataTable<Deposit>
          caption={t('app.deposits.title')}
          rows={DEPOSITS}
          rowKey={(d) => d.unitId + d.tenant}
          columns={[
            {
              key: 'unit',
              header: t('app.portfolio.unit'),
              width: '5.5rem',
              render: (d) => <span className="numeric font-medium">{d.unitId}</span>,
            },
            { key: 'tenant', header: t('app.portfolio.tenant'), render: (d) => d.tenant },
            {
              key: 'held',
              header: t('app.deposits.amountHeld'),
              numeric: true,
              render: (d) => money(d.held, { round: true }),
            },
            {
              key: 'withheld',
              header: t('app.deposits.withheld'),
              numeric: true,
              hideOnMobile: true,
              render: (d) =>
                d.withheld ? (
                  <span className="font-medium text-danger">
                    −{money(d.withheld, { round: true })}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'balance',
              header: t('app.deposits.balance'),
              numeric: true,
              render: (d) => (
                <span className="font-medium">{money(d.held - d.withheld, { round: true })}</span>
              ),
            },
            {
              key: 'status',
              header: t('app.portfolio.status'),
              render: (d) => (
                <StatusPill tone={TONE[d.status]} size="sm">
                  {t(`app.deposits.${d.status}` as 'app.deposits.held')}
                </StatusPill>
              ),
            },
          ]}
        />
      </div>
    </>
  )
}
