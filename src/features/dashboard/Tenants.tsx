import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { DataTable } from '@/components/primitives/DataTable'
import { PaymentStatusPill } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { UNITS, buildingById, type Unit } from '@/data/portfolio'

export function Tenants() {
  const t = useT()
  const { money } = useCurrency()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)

  const leases = UNITS.filter((unit) => unit.tenant !== null)
  const vacant = UNITS.filter((unit) => unit.tenant === null)

  return (
    <>
      <PageHeader
        title={t('app.tenants.title')}
        description={t('app.tenants.subtitle')}
        actions={
          <Button icon="plus" onClick={() => setOpen(true)}>
            {t('app.tenants.addTenant')}
          </Button>
        }
      />

      <DataTable<Unit>
        caption={t('app.tenants.title')}
        rows={leases}
        rowKey={(unit) => unit.id}
        columns={[
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) => (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-semibold text-muted"
                >
                  {unit.tenant
                    ?.split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span className="min-w-0 truncate font-medium">{unit.tenant}</span>
              </div>
            ),
          },
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            render: (unit) => (
              <span className="numeric">
                {unit.id}
                <span className="ml-2 text-mono-label text-muted">
                  {buildingById(unit.buildingId)?.district}
                </span>
              </span>
            ),
          },
          {
            key: 'type',
            header: t('app.portfolio.type'),
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {unit.type} · {unit.surface} m²
              </span>
            ),
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

      {vacant.length > 0 && (
        <p className="mt-4 text-body-s text-muted">
          {t('app.dashboard.vacantUnits', { count: vacant.length })} :{' '}
          {vacant.map((unit) => unit.id).join(', ')}
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('app.tenants.modalTitle')}
        description={t('app.tenants.modalDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                notify(t('app.tenants.created'), { tone: 'ok' })
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label={t('common.fullName')} required>
            {(props) => <Input {...props} autoComplete="name" />}
          </Field>
          <Field label={t('common.phone')} required hint="Le code d’invitation y sera envoyé.">
            {(props) => <Input {...props} type="tel" inputMode="tel" />}
          </Field>
          <Field label={t('app.payments.selectUnit')} required>
            {(props) => (
              <Select {...props}>
                {vacant.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.id} — {unit.type} · {buildingById(unit.buildingId)?.district}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </>
  )
}
