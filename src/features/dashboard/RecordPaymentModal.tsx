import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/** Saisie d'un encaissement. Le règlement partiel est admis par conception. */
export function RecordPaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { money, parseAmount } = useCurrency()
  const { notify } = useToast()
  const { units } = usePortfolio()

  const payable = units.filter((unit) => unit.status !== 'vacant')

  const [unitId, setUnitId] = useState(payable[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mobile')
  const [error, setError] = useState<string | null>(null)

  const unit = units.find((u) => u.id === unitId)

  const submit = () => {
    const parsed = parseAmount(amount)
    if (parsed === null || parsed <= 0) {
      setError(t('app.payments.amountInvalid'))
      return
    }
    setError(null)
    onClose()
    notify(t('app.paymentSaved'), { tone: 'ok' })
    setAmount('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.payments.modalTitle')}
      description={t('app.payments.modalDescription')}
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
        <Field label={t('app.payments.selectUnit')} required>
          {(props) => (
            <Select {...props} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {payable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id} — {u.tenant}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('app.payments.amount')}
          hint={
            unit
              ? t('app.payments.dueAmount', { amount: money(unit.rent, { round: true }) })
              : t('app.payments.amountHint')
          }
          required
          error={error ?? undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="amount"
              inputMode="decimal"
              value={amount}
              placeholder={unit ? money(unit.rent, { round: true, omitSymbol: true }) : ''}
              onChange={(e) => setAmount(e.target.value)}
              className="numeric"
            />
          )}
        </Field>

        <Field label={t('app.payments.method')}>
          {(props) => (
            <Select {...props} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="mobile">{t('app.payments.methodMobile')}</option>
              <option value="cash">{t('app.payments.methodCash')}</option>
              <option value="transfer">{t('app.payments.methodTransfer')}</option>
              <option value="check">{t('app.payments.methodCheck')}</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
