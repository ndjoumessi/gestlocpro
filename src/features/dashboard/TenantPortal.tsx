import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Select, Textarea } from '@/components/primitives/Input'
import { StatusPill } from '@/components/primitives/StatusPill'
import { Icon } from '@/components/primitives/Icon'
import { Logo } from '@/components/primitives/Logo'
import { useToast } from '@/components/primitives/Toast'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { TENANT_RECEIPTS, UNITS, buildingById } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

const TABS = ['space', 'myPayments', 'myWorks', 'documents', 'report'] as const
type Tab = (typeof TABS)[number]

/**
 * Portail locataire, présenté dans un cadre de navigateur : c'est une
 * prévisualisation destinée au propriétaire, pas l'écran réel du locataire.
 * Le cadre évite l'ambiguïté — sans lui, on croirait avoir changé d'application.
 */
export function TenantPortal() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('space')
  const [sent, setSent] = useState(false)

  const { worksForUnit } = usePortfolio()

  const unit = UNITS.find((u) => u.id === 'A1')!
  const myWorks = worksForUnit('A1')

  return (
    <>
      <PageHeader title={t('app.portal.title')} description={t('app.portal.subtitle')} />

      <div className="overflow-hidden rounded-xl border border-border-strong bg-surface-sunken shadow-e2">
        {/* Chrome de navigateur */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            {['#E4B3AA', '#EAD9B4', '#DEE8E1'].map((color) => (
              <span key={color} className="size-2.5 rounded-full" style={{ background: color }} />
            ))}
          </span>
          <span className="numeric truncate rounded-md bg-surface-sunken px-3 py-1 text-mono-label text-muted">
            {t('app.portal.demoUrl')}
          </span>
        </div>

        <div className="bg-canvas">
          {/* En-tête du portail */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-paper px-5 py-3">
            <Logo to="" size="sm" />
            <span
              aria-hidden="true"
              className="ml-auto flex size-8 items-center justify-center rounded-full bg-ink text-label font-semibold text-on-dark"
            >
              CN
            </span>
          </div>

          {/* Onglets */}
          <div
            role="tablist"
            aria-label={t('app.portal.title')}
            className="flex gap-1 overflow-x-auto border-b border-border bg-paper px-3"
          >
            {TABS.map((value) => {
              const active = tab === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(value)}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 cursor-pointer items-center border-b-2 px-3',
                    'text-label font-semibold transition-colors duration-150',
                    active
                      ? 'border-gold text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t(`app.portal.${value}` as 'app.portal.space')}
                </button>
              )
            })}
          </div>

          <div className="p-5">
            {tab === 'space' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <p className="eyebrow text-muted">{t('app.portal.myUnit')}</p>
                  <p className="mt-2 font-sans text-title-l font-semibold">
                    {unit.id} · {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')}
                  </p>
                  {/* Le nom de l'immeuble était écrit en dur : il restait
                      « Résidence Bonamoussadi » quelle que soit l'unité. */}
                  <p className="mt-1 text-body-s text-muted">
                    {unit.surface} m² · {buildingById(unit.buildingId)?.name}
                  </p>
                </Card>

                <Card>
                  <p className="eyebrow text-muted">{t('app.portal.nextDue')}</p>
                  <p className="numeric mt-2 text-mono-kpi font-medium">
                    {money(unit.rent, { round: true })}
                  </p>
                  <div className="mt-2">
                    <StatusPill tone="ok" size="sm">
                      {t('status.paid')}
                    </StatusPill>
                  </div>
                </Card>
              </div>
            )}

            {tab === 'myPayments' && (
              <Card flush>
                <ul className="divide-y divide-divider">
                  {TENANT_RECEIPTS.slice(0, 4).map((receipt) => (
                    <li
                      key={`${receipt.year}-${receipt.month}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 text-body font-medium">
                        {d.monthYear(receipt)}
                      </span>
                      <span className="numeric text-body">{money(unit.rent, { round: true })}</span>
                      <StatusPill tone="ok" size="sm">
                        {t('status.paid')}
                      </StatusPill>
                      <Button variant="ghost" size="sm" icon="download">
                        {t('app.portal.downloadReceipt')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {tab === 'myWorks' && (
              <div className="flex flex-col gap-3">
                {myWorks.map((work) => (
                  <Card key={work.id} className="flex items-center gap-3">
                    <Icon name="wrench" size={18} className="shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium">{work.title}</p>
                      <p className="font-mono text-mono-label text-muted">
                        {work.id} ·{' '}
                        {d.dayMonth(work.reportedAt)}
                      </p>
                    </div>
                    <StatusPill tone={work.status === 'done' ? 'ok' : 'warn'} size="sm">
                      {t(`app.works.${work.status}` as 'app.works.reported')}
                    </StatusPill>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'documents' && (
              <Card flush>
                <ul className="divide-y divide-divider">
                  {(
                    [
                      'app.portal.docLease',
                      'app.portal.docInspection',
                      'app.portal.docReceipt',
                      'app.portal.docInsurance',
                    ] as const
                  ).map((key) => t(key)).map(
                    (doc) => (
                      <li key={doc} className="flex items-center gap-3 px-4 py-3">
                        <Icon name="file" size={17} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-body">{doc}</span>
                        <Button variant="ghost" size="sm" icon="download" aria-label={doc} />
                      </li>
                    ),
                  )}
                </ul>
              </Card>
            )}

            {tab === 'report' && (
              <Card>
                <CardHeader
                  title={t('app.portal.reportIssue')}
                  description={t('app.portal.describeHint')}
                  level={2}
                />

                {sent ? (
                  <p className="flex items-start gap-3 rounded-lg border border-ok-border bg-ok-tint px-4 py-3.5 text-body text-ok">
                    <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
                    {t('app.portal.reportSent')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label={t('app.portal.category')} required>
                        {(props) => (
                          <Select {...props} defaultValue="plumbing">
                            <option value="plumbing">{t('app.trades.plumbing')}</option>
                            <option value="power">{t('app.trades.power')}</option>
                            <option value="lock">{t('app.trades.lock')}</option>
                            <option value="other">{t('app.trades.other')}</option>
                          </Select>
                        )}
                      </Field>

                      <Field label={t('app.portal.urgency')} required>
                        {(props) => (
                          <Select {...props} defaultValue="high">
                            <option value="high">{t('app.portal.urgencyHigh')}</option>
                            <option value="medium">{t('app.portal.urgencyMedium')}</option>
                            <option value="low">{t('app.portal.urgencyLow')}</option>
                          </Select>
                        )}
                      </Field>
                    </div>

                    <Field label={t('app.portal.describe')} required>
                      {(props) => <Textarea {...props} />}
                    </Field>

                    <Button
                      onClick={() => {
                        setSent(true)
                        notify(t('app.portal.reportSent'), { tone: 'ok' })
                      }}
                    >
                      {t('app.portal.report')}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
