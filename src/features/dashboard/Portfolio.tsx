import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { PaymentStatusPill } from '@/components/primitives/StatusPill'
import { StatCard } from '@/components/primitives/Charts'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { BUILDINGS, buildingById, type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

export function Portfolio() {
  const t = useT()
  const { money } = useCurrency()
  const { units } = usePortfolio()
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState<string | 'all'>('all')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return units.filter((unit) => {
      if (building !== 'all' && unit.buildingId !== building) return false
      if (!needle) return true
      const haystack = [
        unit.id,
        unit.type,
        unit.tenant ?? '',
        buildingById(unit.buildingId)?.name ?? '',
        buildingById(unit.buildingId)?.district ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, building, units])

  const occupied = units.filter((u) => u.status !== 'vacant').length

  return (
    <>
      <PageHeader title={t('app.portfolio.title')} description={t('app.portfolio.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BUILDINGS.map((b) => (
          <StatCard
            key={b.id}
            label={b.district}
            value={`${b.occupied}/${b.units}`}
            note={t('app.portfolio.occupancy', { occupied: b.occupied, total: b.units })}
          />
        ))}
        <StatCard
          label={t('app.dashboard.occupancy')}
          value={`${Math.round((occupied / units.length) * 100)}`}
          unit="%"
          note={t('app.portfolio.occupancy', { occupied, total: units.length })}
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            icon="search"
            type="search"
            aria-label={t('nav.searchPlaceholder')}
            placeholder={t('nav.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div role="group" aria-label={t('app.portfolio.building')} className="flex flex-wrap gap-1.5">
          {[{ id: 'all', district: t('app.portfolio.filterAll') }, ...BUILDINGS].map((b) => {
            const active = building === b.id
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => setBuilding(b.id)}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3.5',
                  'text-label font-semibold transition-colors duration-150',
                  active
                    ? 'border-ink bg-ink text-on-dark'
                    : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
                )}
              >
                {b.district}
              </button>
            )
          })}
        </div>
      </div>

      <DataTable<Unit>
        caption={t('app.portfolio.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        empty={
          <EmptyState
            title={t('app.portfolio.searchEmpty', { query })}
            body={t('app.portfolio.searchEmptyHint')}
            action={
              <Button variant="secondary" onClick={() => { setQuery(''); setBuilding('all') }}>
                {t('app.portfolio.filterAll')}
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
            key: 'building',
            header: t('app.portfolio.building'),
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">{buildingById(unit.buildingId)?.district}</span>
            ),
          },
          {
            key: 'type',
            header: t('app.portfolio.type'),
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {unit.type} · {unit.surface} m²
              </span>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) =>
              unit.tenant ?? <span className="text-muted italic">{t('app.portfolio.noTenant')}</span>,
          },
          {
            key: 'rent',
            header: t('app.portfolio.rent'),
            numeric: true,
            render: (unit) => money(unit.rent, { round: true }),
          },
          {
            key: 'status',
            header: t('app.portfolio.status'),
            render: (unit) => <PaymentStatusPill status={unit.status} size="sm" />,
          },
        ]}
      />
    </>
  )
}
