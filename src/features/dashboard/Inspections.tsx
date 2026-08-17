import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { TenantScopeNote } from './TenantDashboard'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'

import { usePortfolio } from '@/data/PortfolioProvider'

export function Inspections() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { unitById, isMine, inspections: INSPECTIONS, loading } = usePortfolio()
  const isTenant = role === 'tenant'
  const source = isTenant ? INSPECTIONS.filter((i) => isMine(i.unitId)) : INSPECTIONS

  // Regroupé par unité : l'intérêt d'un état des lieux est la comparaison
  // entrée/sortie, pas la liste chronologique.
  const byUnit = source.reduce<Record<string, typeof INSPECTIONS>>((acc, inspection) => {
    ;(acc[inspection.unitId] ??= []).push(inspection)
    return acc
  }, {})

  /**
   * Un état des lieux est une pièce contradictoire : il porte des réserves
   * chiffrées, signées ou non, et c'est lui qui justifie ce qu'on retient sur
   * une caution. En servir de faux pendant l'attente — « 4 réserves », « en
   * attente de signature » — met sous les yeux du bailleur des griefs contre
   * des locataires qu'il n'a pas.
   */
  if (loading) return <InspectionsSkeleton />

  return (
    <>
      <PageHeader title={t('app.inspections.title')} description={t('app.inspections.subtitle')} />

      {isTenant && <TenantScopeNote />}

      {/*
        Le titre valait pour le locataire et se servait aussi au propriétaire.
        Le corps dit à quoi sert un état des lieux — l'entrée, la sortie, et la
        comparaison qui justifie la retenue sur caution — parce que c'est
        précisément ce qu'ignore celui qui découvre cet écran vide.

        AUCUNE action, pour personne, et c'est le point : le produit ne sait pas
        établir un état des lieux. Un locataire n'en crée pas lui-même, et un
        bouton « nouvel état des lieux » côté bailleur ouvrirait sur du vide.
        On préfère un état vide honnête à un gabarit rempli.
      */}
      {Object.keys(byUnit).length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={isTenant ? t('app.tenant.inspectionsEmpty') : t('app.inspections.emptyTitle')}
          body={
            isTenant ? t('app.tenant.inspectionsEmptyBody') : t('app.inspections.emptyBody')
          }
        />
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
                  <h2 className="title-m">
                    {unit?.label ?? unitId} ·{' '}
                    {unit && t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
                  </h2>
                  <p className="text-caps text-muted">
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
                      <p className="text-caps text-muted">
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
                        <span className="text-caps text-warn">
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

/**
 * Les états des lieux, le temps qu'ils arrivent.
 *
 * Aucune action à retenir : l'en-tête n'en porte pas.
 *
 * Deux cartes, pas quatre : la grille passe à deux colonnes au-delà de `lg`, et
 * deux remplissent une rangée sans promettre un parc plus grand qu'il ne l'est.
 * Chacune reprend le gabarit d'un regroupement par unité — l'en-tête de carte,
 * puis deux lignes de constat, la hauteur qui compte ici.
 */
function InspectionsSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.inspections.title')} description={t('app.inspections.subtitle')} />

      <SkeletonRegion className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((carte) => (
          <div
            key={carte}
            className="min-w-0 rounded-lg border border-divider bg-surface p-4 shadow-e1 sm:p-5"
          >
            <div className="mb-4">
              <Skeleton line="title" className="w-40" />
              <Skeleton line="eyebrow" className="mt-1 w-32" />
            </div>
            <div className="flex flex-col gap-2.5">
              {[0, 1].map((ligne) => (
                <div
                  key={ligne}
                  className="flex items-center gap-3 rounded-md border border-divider px-3.5 py-3"
                >
                  <Skeleton radius="md" className="size-9" />
                  <div className="min-w-0 flex-1">
                    <Skeleton line="body" className="w-20" />
                    <Skeleton line="eyebrow" className="mt-0.5 w-36 max-w-full" />
                  </div>
                  <Skeleton radius="md" className="h-7 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
    </>
  )
}
