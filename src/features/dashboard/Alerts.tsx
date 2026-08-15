import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Icon, type IconName } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { ALERTS, type Alert } from '@/data/portfolio'

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
  const [alerts, setAlerts] = useState(ALERTS)

  const unread = alerts.filter((alert) => !alert.read).length

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
              onClick={() => setAlerts((list) => list.map((a) => ({ ...a, read: true })))}
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

      {alerts.length === 0 ? (
        <EmptyState icon="bell" title={t('app.alerts.allRead')} />
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

              <span className="shrink-0 font-mono text-mono-label text-muted">{alert.at}</span>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
