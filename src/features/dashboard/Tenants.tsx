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
import { buildingById, type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { validateName, validatePhone, type FieldError } from '@/features/auth/validation'

export function Tenants() {
  const t = useT()
  const { money } = useCurrency()
  const [open, setOpen] = useState(false)

  // Unités partagées : rattacher un locataire doit se voir ici, dans le parc
  // immobilier et dans le taux d'occupation du tableau de bord.
  const { units } = usePortfolio()

  const leases = units.filter((unit) => unit.tenant !== null)
  const vacant = units.filter((unit) => unit.tenant === null)

  return (
    <>
      <PageHeader
        title={t('app.tenants.title')}
        description={t('app.tenants.subtitle')}
        actions={
          <Button icon="plus" onClick={() => setOpen(true)} disabled={vacant.length === 0}>
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

      {open && <NewTenantModal vacant={vacant} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Création d'une fiche locataire.
 *
 * Elle ne validait rien : soumise à vide, elle annonçait « code d'invitation
 * envoyé par SMS » pour un locataire sans nom et un numéro inexistant. Elle
 * emprunte désormais les validateurs de l'inscription — mêmes règles, mêmes
 * messages, une seule définition de ce qu'est un nom ou un téléphone valide.
 */
function NewTenantModal({ vacant, onClose }: { vacant: Unit[]; onClose: () => void }) {
  const t = useT()
  const { notify } = useToast()
  const { addTenant } = usePortfolio()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [unitId, setUnitId] = useState(vacant[0]?.id ?? '')
  const [errors, setErrors] = useState<{ name: FieldError; phone: FieldError }>({
    name: null,
    phone: null,
  })
  const [touched, setTouched] = useState({ name: false, phone: false })

  const submit = () => {
    const next = { name: validateName(name), phone: validatePhone(phone) }
    setErrors(next)
    setTouched({ name: true, phone: true })

    if (next.name || next.phone) {
      document.querySelector<HTMLElement>(`[name="${next.name ? 'name' : 'phone'}"]`)?.focus()
      return
    }

    addTenant(unitId, name.trim())
    onClose()
    notify(t('app.tenants.created'), { tone: 'ok' })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('app.tenants.modalTitle')}
      description={t('app.tenants.modalDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label={t('common.fullName')}
          required
          error={touched.name && errors.name ? t(errors.name) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, name: true }))
                setErrors((s) => ({ ...s, name: validateName(name) }))
              }}
            />
          )}
        </Field>

        <Field
          label={t('common.phone')}
          required
          hint={t('app.tenants.phoneHint')}
          error={touched.phone && errors.phone ? t(errors.phone) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, phone: true }))
                setErrors((s) => ({ ...s, phone: validatePhone(phone) }))
              }}
            />
          )}
        </Field>

        <Field label={t('app.payments.selectUnit')} required>
          {(props) => (
            <Select
              {...props}
              name="unitId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
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
  )
}
