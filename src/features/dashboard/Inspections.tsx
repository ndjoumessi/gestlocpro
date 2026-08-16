import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { TenantScopeNote } from './TenantDashboard'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { INSPECTIONS } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

export function Inspections() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { unitById, isMine } = usePortfolio()
  const isTenant = role === 'tenant'
  const source = isTenant ? INSPECTIONS.filter((i) => isMine(i.unitId)) : INSPECTIONS

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
          // Le badge « comparer entrée et sortie » se déclenchait sur le
          // nombre de lignes : deux entrées successives l'auraient allumé
          // sans qu'aucune sortie n'existe. Il teste les deux natures.
          const hasBoth =
            inspections.some((i) => i.kind === 'entry') &&
            inspections.some((i) => i.kind === 'exit')
          // L'ordre venait du tableau source, qui plaçait la sortie de B4
          // avant son entrée — une comparaison à rebours du temps.
          const chronological = [...inspections].sort(
            (a, b) =>
              a.date.year - b.date.year || a.date.month - b.date.month || a.date.day - b.date.day,
          )

          return (
            <Card key={unitId}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  {/* Le regroupement se fait sur l'identifiant technique, mais
                      c'est le libellé de l'unité qui se lit dans le titre. */}
                  <h2 className="font-sans text-title-m font-semibold">
                    {unit?.label ?? unitId} ·{' '}
                    {unit && t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
                  </h2>
                  <p className="font-mono text-mono-label text-muted">
                    {unit?.tenant ?? t('app.portfolio.noTenant')}
                  </p>
                </div>
                {hasBoth && <Badge tone="gold">{t('app.inspections.compare')}</Badge>}
              </div>

              <div className="flex flex-col gap-2.5">
                {chronological.map((inspection) => (
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
                        {d.fullDate(inspection.date)}{' · '}
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
