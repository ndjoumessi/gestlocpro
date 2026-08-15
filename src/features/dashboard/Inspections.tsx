import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { TenantScopeNote } from './TenantDashboard'
import { useI18n, useT } from '@/i18n/I18nProvider'
import { formatFullDate } from '@/lib/dates'
import { CURRENT_TENANT_UNIT, INSPECTIONS, inspectionsForUnit, unitById } from '@/data/portfolio'

export function Inspections() {
  const t = useT()
  const { locale } = useI18n()
  const { role } = useRole()
  const isTenant = role === 'tenant'
  const source = isTenant ? inspectionsForUnit(CURRENT_TENANT_UNIT) : INSPECTIONS

  // Regroupé par unité : l'intérêt d'un état des lieux est la comparaison
  // entrée/sortie, pas la liste chronologique.
  const byUnit = source.reduce<Record<string, typeof INSPECTIONS>>((acc, inspection) => {
    ;(acc[inspection.unitId] ??= []).push(inspection)
    return acc
  }, {})

  return (
    <>
      <PageHeader title={t('app.inspections.title')} description={t('app.inspections.subtitle')} />

      {isTenant && <TenantScopeNote />}

      {Object.keys(byUnit).length === 0 ? (
        <EmptyState icon="clipboard" title={t('app.tenant.inspectionsEmpty')} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(byUnit).map(([unitId, inspections]) => {
          const unit = unitById(unitId)
          const hasBoth = inspections.length > 1

          return (
            <Card key={unitId}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-sans text-title-m font-semibold">
                    {unitId} · {unit?.type}
                  </h2>
                  <p className="font-mono text-mono-label text-muted">
                    {unit?.tenant ?? t('app.portfolio.noTenant')}
                  </p>
                </div>
                {hasBoth && <Badge tone="gold">{t('app.inspections.compare')}</Badge>}
              </div>

              <div className="flex flex-col gap-2.5">
                {inspections.map((inspection) => (
                  <div
                    key={`${inspection.kind}-${inspection.date.year}-${inspection.date.month}`}
                    className="flex items-center gap-3 rounded-md border border-divider bg-surface-sunken px-3.5 py-3"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                        inspection.kind === 'entry'
                          ? 'bg-ok-tint text-ok'
                          : 'bg-gold-tint text-gold-ink'
                      }`}
                    >
                      <Icon
                        name={inspection.kind === 'entry' ? 'arrowRight' : 'logout'}
                        size={16}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium">
                        {t(`app.inspections.${inspection.kind}` as 'app.inspections.entry')}
                      </p>
                      <p className="font-mono text-mono-label text-muted">
                        {formatFullDate(inspection.date.year, inspection.date.month, inspection.date.day, locale)}{' · '}
                        {t('app.inspections.rooms', { count: inspection.rooms })}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill
                        tone={inspection.issues === 0 ? 'ok' : inspection.issues > 3 ? 'danger' : 'warn'}
                        size="sm"
                      >
                        {inspection.issues === 0
                          ? t('app.inspections.noIssues')
                          : t('app.inspections.issues', { count: inspection.issues })}
                      </StatusPill>
                      {!inspection.signed && (
                        <span className="font-mono text-mono-label text-warn">
                          {t('app.inspections.unsigned')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
      )}
    </>
  )
}
