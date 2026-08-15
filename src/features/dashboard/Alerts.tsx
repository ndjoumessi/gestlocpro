import { useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { cn } from '@/lib/cn'
import { TenantScopeNote } from './TenantDashboard'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { ALERTS, CURRENT_TENANT_UNIT, alertsForUnit, type Alert } from '@/data/portfolio'

const KIND_ICON: Record<Alert['kind'], IconName> = {
  payment: 'card',
  work: 'wrench',
  meter: 'gauge',
  lease: 'file',
}

const SEVERITY_TONE: Record<Alert['severity'], StatusTone> = {
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
}

export function Alerts() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const isTenant = role === 'tenant'

  /**
   * La liste se **dérive** du rôle à chaque rendu, elle ne s'y fige pas.
   *
   * Elle était initialisée dans un `useState` : l'initialiseur ne s'exécutant
   * qu'au montage, basculer de profil sans changer d'écran laissait le
   * locataire devant les notifications de tout le parc — les impayés de ses
   * voisins compris. Le défaut échappait à toute vérification manuelle qui
   * naviguait après la bascule, puisque naviguer remonte le composant.
   *
   * Seul l'état « lu » est conservé, sous forme d'identifiants : c'est la seule
   * chose que l'écran modifie réellement.
   */
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const alerts = (isTenant ? alertsForUnit(CURRENT_TENANT_UNIT) : ALERTS).map((alert) => ({
    ...alert,
    read: alert.read || readIds.has(alert.id),
  }))

  const unread = alerts.filter((alert) => !alert.read).length

  const markAllRead = () => setReadIds(new Set(alerts.map((alert) => alert.id)))

  return (
    <>
      <PageHeader
        title={t('app.alerts.title')}
        description={t('app.alerts.subtitle')}
        actions={
          unread > 0 && (
            <Button
              variant="secondary"
              icon="check"
              onClick={markAllRead}
            >
              {t('app.alerts.markRead')}
            </Button>
          )
        }
      />

      {unread > 0 && (
        <p className="mb-4 font-mono text-mono-label text-muted">
          {t('app.alerts.unread', { count: unread })}
        </p>
      )}

      {isTenant && <TenantScopeNote />}

      {alerts.length === 0 ? (
        <EmptyState icon="bell" title={t('app.tenant.alertsEmpty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={cn('flex items-start gap-4', !alert.read && 'border-l-2 border-l-gold')}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-md',
                  alert.severity === 'high'
                    ? 'bg-danger-tint text-danger'
                    : alert.severity === 'medium'
                      ? 'bg-warn-tint text-warn'
                      : 'bg-surface-sunken text-muted',
                )}
              >
                <Icon name={KIND_ICON[alert.kind]} size={18} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className={cn(
                      'font-sans text-title-m',
                      alert.read ? 'font-medium' : 'font-semibold',
                    )}
                  >
                    {alert.title}
                  </h2>
                  {/* La sévérité est nommée, pas seulement colorée. */}
                  <StatusPill tone={SEVERITY_TONE[alert.severity]} size="sm">
                    {t(
                      `app.alerts.severity${alert.severity[0].toUpperCase()}${alert.severity.slice(1)}` as 'app.alerts.severityHigh',
                    )}
                  </StatusPill>
                </div>
                <p className="mt-1 text-body-s text-muted">{alert.detail}</p>
              </div>

              <span className="shrink-0 font-mono text-mono-label text-muted">
                {d.relative(alert.at)}
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
