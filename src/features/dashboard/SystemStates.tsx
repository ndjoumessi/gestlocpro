import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'

/**
 * Les quatre états que toute vue de données doit savoir rendre.
 * Cet écran sert de référence : on y vérifie qu'aucun d'eux ne se réduit à un
 * écran blanc ou à un cadre d'axes vide.
 */
export function SystemStates() {
  const t = useT()
  const { notify } = useToast()

  return (
    <>
      <PageHeader title={t('app.system.title')} description={t('app.system.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('app.system.loading')} level={2} />
          {/* Squelette plutôt que spinner : la mise en page ne saute pas
              quand les données arrivent. */}
          <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t('common.loading')}</span>
            {[80, 100, 65, 90].map((width, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="block h-3.5 rounded-full bg-surface-sunken"
                style={{
                  width: `${width}%`,
                  backgroundImage:
                    'linear-gradient(90deg, var(--color-surface-sunken) 0%, var(--color-border) 50%, var(--color-surface-sunken) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'gl-shimmer 1.4s linear infinite',
                }}
              />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('app.system.empty')} level={2} />
          <EmptyState
            icon="card"
            title={t('app.system.emptyTitle')}
            body={t('app.system.emptyBody')}
          />
        </Card>

        <Card>
          <CardHeader title={t('app.system.error')} level={2} />
          {/* Une erreur dit ce qui a échoué, ce qui est préservé, et propose
              une sortie — pas seulement « une erreur est survenue ». */}
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-tint px-4 py-3.5"
          >
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <p className="text-body font-semibold text-danger">{t('app.system.errorTitle')}</p>
              <p className="mt-1 text-body-s text-danger">{t('app.system.errorBody')}</p>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowRight"
                className="mt-3"
                onClick={() => notify(t('app.system.retried'), { tone: 'ok' })}
              >
                {t('app.system.retry')}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('app.system.offline')} level={2} />
          <div className="flex items-start gap-3 rounded-lg border border-warn-border bg-warn-tint px-4 py-3.5">
            <Icon name="globe" size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-body font-semibold text-warn">{t('app.system.offlineTitle')}</p>
              <p className="mt-1 text-body-s text-warn">{t('app.system.offlineBody')}</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
