import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { EmptyState } from '@/components/primitives/DataTable'
import { TenantScopeNote } from './TenantDashboard'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { CURRENT_TENANT_UNIT, type WorkOrder } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

const STATUS_TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'neutral',
  quoted: 'warn',
  approved: 'info',
  done: 'ok',
}

export function Works() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { notify } = useToast()
  const { role } = useRole()

  // Seul le propriétaire arbitre : le gestionnaire propose. C'est la règle de
  // délégation de la maquette, appliquée ici à l'affichage du bouton.
  const canApprove = role === 'owner'
  const isTenant = role === 'tenant'

  /**
   * Travaux et cautions vivent dans un état partagé : une décision prise ici
   * doit disparaître de la carte « Ce qui demande une décision » du tableau de
   * bord, qui la réclamait encore.
   */
  const { works, worksForUnit, approveWork, unitById } = usePortfolio()

  // Le locataire suit les interventions sur SON logement, pas celles du parc.
  const visible = isTenant ? worksForUnit(CURRENT_TENANT_UNIT) : works

  const approve = (id: string) => {
    approveWork(id)
    notify(t('app.works.approved_toast'), { tone: 'ok' })
  }

  return (
    <>
      <PageHeader title={t('app.works.title')} description={t('app.works.subtitle')} />

      {isTenant && <TenantScopeNote />}

      {visible.length === 0 ? (
        <EmptyState icon="wrench" title={t('app.tenant.worksEmpty')} />
      ) : (
      <div className="flex flex-col gap-3">
        {visible.map((work) => {
          const unit = unitById(work.unitId)
          return (
            <Card key={work.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                  work.urgent ? 'bg-danger-tint text-danger' : 'bg-surface-sunken text-muted'
                }`}
              >
                <Icon name="wrench" size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-sans text-title-m font-semibold">{work.title}</h2>
                  {work.urgent && <Badge tone="danger">{t('app.works.urgent')}</Badge>}
                </div>
                <p className="mt-1 font-mono text-mono-label text-muted">
                  {work.id} · {work.unitId} {unit?.tenant ? `· ${unit.tenant}` : ''} · {work.trade} ·{' '}
                  {d.dayMonth(work.reportedAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="numeric text-title-m font-medium">
                  {work.amount ? (
                    money(work.amount, { round: true })
                  ) : (
                    <span className="text-body-s font-normal text-muted italic">
                      {t('app.works.noQuote')}
                    </span>
                  )}
                </span>

                <StatusPill tone={STATUS_TONE[work.status]} size="sm">
                  {t(`app.works.${work.status}` as 'app.works.reported')}
                </StatusPill>

                {work.status === 'quoted' && canApprove && (
                  <Button
                    size="sm"
                    onClick={() => approve(work.id)}
                  >
                    {t('app.works.approve')}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      )}
    </>
  )
}
