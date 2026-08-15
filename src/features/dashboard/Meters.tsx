import { PageHeader } from '@/components/layout/AppShell'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { READINGS, UTILITY_RATES, unitById, type MeterReading } from '@/data/portfolio'

/**
 * Relevé des compteurs.
 *
 * La maquette d'origine noyait cet écran dans « Paiements ». Il est promu en
 * page à part entière : c'est le geste de terrain le plus fréquent du
 * gestionnaire, et un relevé manquant bloque la facturation du mois — ce qui
 * mérite d'être visible sans avoir à faire défiler un autre écran.
 */
export function Meters() {
  const t = useT()
  const { money } = useCurrency()
  const { notify } = useToast()

  const consumption = (reading: MeterReading) => ({
    water: reading.waterCurrent === null ? null : reading.waterCurrent - reading.waterPrevious,
    power: reading.powerCurrent === null ? null : reading.powerCurrent - reading.powerPrevious,
  })

  const rebilled = (reading: MeterReading) => {
    const c = consumption(reading)
    if (c.water === null || c.power === null) return null
    return c.water * UTILITY_RATES.water + c.power * UTILITY_RATES.power
  }

  const missing = READINGS.filter((r) => r.waterCurrent === null || r.powerCurrent === null)
  const total = READINGS.reduce((sum, r) => sum + (rebilled(r) ?? 0), 0)

  return (
    <>
      <PageHeader
        title={t('app.meters.title')}
        description={t('app.meters.subtitle')}
        actions={
          <Button variant="secondary" icon="download" onClick={() => notify(t('app.exported'))}>
            {t('app.exportStatement')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('app.meters.totalRebilled')}
          value={money(total, { round: true })}
          note={`${READINGS.length - missing.length}/${READINGS.length}`}
        />
        <StatCard
          label={t('app.meters.water')}
          value={`${UTILITY_RATES.water}`}
          unit={`/ m³`}
        />
        <StatCard label={t('app.meters.power')} value={`${UTILITY_RATES.power}`} unit="/ kWh" />
      </div>

      {/* Un relevé manquant a une conséquence concrète : on la nomme, plutôt
          que d'afficher un simple compteur. */}
      <div
        className={`mt-6 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3.5 ${
          missing.length
            ? 'border-warn-border bg-warn-tint text-warn'
            : 'border-ok-border bg-ok-tint text-ok'
        }`}
      >
        <Icon name={missing.length ? 'alert' : 'checkCircle'} size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-body font-semibold">
            {missing.length
              ? t('app.meters.missingCount', { count: missing.length })
              : t('app.meters.complete')}
          </p>
          {missing.length > 0 && (
            <p className="mt-0.5 text-body-s">
              {t('app.meters.missingHint')} — {missing.map((r) => r.unitId).join(', ')}
            </p>
          )}
        </div>
      </div>

      <DataTable<MeterReading>
        caption={t('app.meters.title')}
        rows={READINGS}
        rowKey={(reading) => reading.unitId}
        columns={[
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            render: (r) => (
              <div>
                <span className="numeric font-medium">{r.unitId}</span>
                <span className="block truncate text-body-s text-muted sm:hidden">
                  {unitById(r.unitId)?.tenant}
                </span>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            hideOnMobile: true,
            render: (r) => <span className="text-muted">{unitById(r.unitId)?.tenant}</span>,
          },
          {
            key: 'water',
            header: `${t('app.meters.water')} (m³)`,
            numeric: true,
            render: (r) => {
              const c = consumption(r).water
              return c === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span>
                  {c}
                  <span className="ml-1.5 text-mono-label text-muted">
                    {r.waterPrevious}→{r.waterCurrent}
                  </span>
                </span>
              )
            },
          },
          {
            key: 'power',
            header: `${t('app.meters.power')} (kWh)`,
            numeric: true,
            render: (r) => {
              const c = consumption(r).power
              return c === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span>
                  {c}
                  <span className="ml-1.5 text-mono-label text-muted">
                    {r.powerPrevious}→{r.powerCurrent}
                  </span>
                </span>
              )
            },
          },
          {
            key: 'rebilled',
            header: t('app.meters.rebilled'),
            numeric: true,
            render: (r) => {
              const value = rebilled(r)
              return value === null ? (
                <StatusPill tone="warn" size="sm">
                  {t('app.meters.missing')}
                </StatusPill>
              ) : (
                <span className="font-medium">{money(value, { round: true })}</span>
              )
            },
          },
          {
            key: 'readAt',
            header: t('app.meters.readAt'),
            hideOnMobile: true,
            render: (r) => <span className="numeric text-muted">{r.readAt ?? '—'}</span>,
          },
        ]}
      />
    </>
  )
}
