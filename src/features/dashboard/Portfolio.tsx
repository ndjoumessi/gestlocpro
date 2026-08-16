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
        // Le libellé et non l'identifiant : c'est « A1 » que l'utilisateur voit
        // dans la colonne et retape ici, pas l'uuid que servira l'API.
        unit.label,
        // La typologie est cherchée sur son libellé traduit et non sur la clé :
        // un anglophone qui voit « 2-bed » à l'écran tape « bed », pas « T3 ».
        t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1'),
        unit.tenant ?? '',
        buildingById(unit.buildingId)?.name ?? '',
        buildingById(unit.buildingId)?.district ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, building, units, t])

  const occupied = units.filter((u) => u.status !== 'vacant').length

  /**
   * L'occupation par immeuble se dérive de l'état vivant.
   *
   * Elle lisait `BUILDINGS`, une constante figée, tandis que la carte globale
   * juste à côté comptait les unités du provider. Rattacher un locataire fait
   * passer une unité de `vacant` à `pending` : le total bougeait, les quatre
   * cartes d'immeuble non. Deux chiffres contradictoires sur la même ligne.
   */
  const occupancyOf = (buildingId: string) => {
    const inBuilding = units.filter((u) => u.buildingId === buildingId)
    return { occupied: inBuilding.filter((u) => u.status !== 'vacant').length, total: inBuilding.length }
  }

  return (
    <>
      <PageHeader title={t('app.portfolio.title')} description={t('app.portfolio.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BUILDINGS.map((b) => {
          const { occupied: occ, total } = occupancyOf(b.id)
          return (
            <StatCard
              key={b.id}
              label={b.district}
              value={`${occ}/${total}`}
              note={t('app.portfolio.occupancy', { occupied: occ, total })}
            />
          )
        })}
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
            // Ce bouton réutilisait la clé du filtre, donc il s'appelait
            // « Tous » / « All » : le libellé d'un filtre, pas d'une action.
            // Il réinitialise la recherche ET l'immeuble — il le dit.
            action={
              <Button variant="secondary" onClick={() => { setQuery(''); setBuilding('all') }}>
                {t('app.portfolio.resetFilters')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (unit) => <span className="numeric font-medium">{unit.label}</span>,
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
            // La colonne s'intitulait « Type » mais ses cellules portent la
            // typologie ET la surface : un lecteur d'écran annonçait « Type »
            // sur « T3 · 78 m² ». La clé `surface` existait, inutilisée.
            header: `${t('app.portfolio.type')} · ${t('app.portfolio.surface')}`,
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
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
