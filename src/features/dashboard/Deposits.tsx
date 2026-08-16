import { useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { DataTable } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input, Textarea } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { type Deposit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'

const TONE: Record<Deposit['status'], StatusTone> = {
  held: 'info',
  settling: 'warn',
  returned: 'ok',
}

export function Deposits() {
  const t = useT()
  const { money } = useCurrency()
  const { role } = useRole()
  const { notify } = useToast()

  // Les cautions viennent de l'état partagé : arbitrer ici doit se voir dans
  // l'espace locataire, qui affiche la caution consignée du bail.
  const { deposits, settleDeposit, unitById } = usePortfolio()
  const [settling, setSettling] = useState<Deposit | null>(null)

  /**
   * Arbitrer une caution est le droit qui distingue le propriétaire du
   * gestionnaire — c'est écrit dans la matrice des droits. L'écran ne
   * l'exposait nulle part : deux cautions étaient « en cours d'arbitrage »
   * sans moyen de les arbitrer.
   */
  const canSettle = role === 'owner'

  const totalHeld = deposits.reduce((sum, d) => sum + d.held, 0)
  const totalWithheld = deposits.reduce((sum, d) => sum + d.withheld, 0)

  const settle = (unitId: string, withheld: number) => {
    settleDeposit(unitId, withheld)
    setSettling(null)
    notify(t('app.deposits.settled'), { tone: 'ok' })
  }

  return (
    <>
      <PageHeader title={t('app.deposits.title')} description={t('app.deposits.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('app.deposits.totalHeld')} value={money(totalHeld, { round: true })} />
        <StatCard label={t('app.deposits.withheld')} value={money(totalWithheld, { round: true })} />
        <StatCard
          label={t('app.deposits.balance')}
          value={money(totalHeld - totalWithheld, { round: true })}
        />
      </div>

      {/* Le gestionnaire voit les cautions mais ne les arbitre pas. On lui dit
          pourquoi le bouton lui manque, plutôt que de le laisser deviner. */}
      {role === 'manager' && (
        <p className="mt-6 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.deposits.managerNotice')}
        </p>
      )}

      <div className="mt-6">
        <DataTable<Deposit>
          caption={t('app.deposits.title')}
          rows={deposits}
          rowKey={(d) => d.unitId}
          columns={[
            {
              key: 'unit',
              header: t('app.portfolio.unit'),
              width: '5.5rem',
              // `unitId` est l'identifiant technique — un `uuid` une fois les
              // données servies par l'API. C'est le libellé qui s'affiche.
              render: (d) => (
                <span className="numeric font-medium">
                  {unitById(d.unitId)?.label ?? d.unitId}
                </span>
              ),
            },
            {
              key: 'tenant',
              header: t('app.portfolio.tenant'),
              render: (d) => d.tenant ?? t('app.deposits.formerTenant'),
            },
            {
              key: 'held',
              header: t('app.deposits.amountHeld'),
              numeric: true,
              render: (d) => money(d.held, { round: true }),
            },
            {
              key: 'withheld',
              header: t('app.deposits.withheld'),
              numeric: true,
              hideOnMobile: true,
              render: (d) =>
                d.withheld ? (
                  <span className="font-medium text-danger">
                    −{money(d.withheld, { round: true })}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'balance',
              header: t('app.deposits.balance'),
              numeric: true,
              render: (d) => (
                <span className="font-medium">{money(d.held - d.withheld, { round: true })}</span>
              ),
            },
            {
              key: 'status',
              header: t('app.portfolio.status'),
              render: (d) => (
                <div className="flex items-center justify-between gap-3">
                  <StatusPill tone={TONE[d.status]} size="sm">
                    {t(`app.deposits.${d.status}` as 'app.deposits.held')}
                  </StatusPill>
                  {d.status === 'settling' && canSettle && (
                    <Button size="sm" onClick={() => setSettling(d)}>
                      {t('app.deposits.settle')}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {settling && (
        <SettleModal deposit={settling} onClose={() => setSettling(null)} onConfirm={settle} />
      )}
    </>
  )
}

/**
 * Arbitrage d'une caution.
 *
 * Le solde se recalcule à la saisie : c'est le chiffre que le locataire
 * recevra, il doit être visible pendant qu'on décide, pas après. Une retenue
 * non justifiée est refusée — le locataire peut la contester, et un décompte
 * sans motif est indéfendable.
 */
function SettleModal({
  deposit,
  onClose,
  onConfirm,
}: {
  deposit: Deposit
  onClose: () => void
  onConfirm: (unitId: string, withheld: number) => void
}) {
  const t = useT()
  const { money, parseAmount } = useCurrency()
  const { unitById } = usePortfolio()

  const [withheld, setWithheld] = useState(String(deposit.withheld || ''))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ withheld?: string; reason?: string }>({})

  // Voir `parseMoney` : lire la virgule comme un séparateur décimal quelle que
  // soit la devise faisait d'une retenue de « 1,450 » une retenue de 1,45.
  const parsed = parseAmount(withheld) ?? 0
  const balance = deposit.held - parsed

  const submit = () => {
    const next: typeof errors = {}
    if (parsed > deposit.held) {
      next.withheld = t('app.deposits.errorTooHigh', {
        amount: money(deposit.held, { round: true }),
      })
    }
    if (parsed > 0 && reason.trim().length < 3) {
      next.reason = t('app.deposits.errorJustification')
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onConfirm(deposit.unitId, parsed)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('app.deposits.settleTitle')}
      description={t('app.deposits.settleDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('app.deposits.confirmSettle')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-md border border-divider bg-surface-sunken px-4 py-3">
          <span className="numeric text-title-m font-medium">
            {unitById(deposit.unitId)?.label ?? deposit.unitId}
          </span>
          <span className="min-w-0 flex-1 truncate text-body text-muted">
            {deposit.tenant ?? t('app.deposits.formerTenant')}
          </span>
          <span className="numeric text-body font-medium">
            {money(deposit.held, { round: true })}
          </span>
        </div>

        <Field
          label={t('app.deposits.withheldAmount')}
          hint={t('app.deposits.withheldHint')}
          error={errors.withheld}
        >
          {(props) => (
            <Input
              {...props}
              name="withheld"
              inputMode="decimal"
              value={withheld}
              placeholder="0"
              onChange={(e) => setWithheld(e.target.value)}
              className="numeric"
            />
          )}
        </Field>

        <Field
          label={t('app.deposits.justification')}
          hint={t('app.deposits.justificationHint')}
          error={errors.reason}
          optional={parsed === 0}
        >
          {(props) => (
            <Textarea
              {...props}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>

        {/* Le solde est calculé sous les yeux de celui qui décide. */}
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3.5 ${
            balance < 0
              ? 'border-danger-border bg-danger-tint text-danger'
              : 'border-ok-border bg-ok-tint text-ok'
          }`}
        >
          <span className="text-body font-semibold">{t('app.deposits.balanceToReturn')}</span>
          {/* `money()` porte déjà le symbole : en ajouter un second donnait
              « 185 000 FCFA FCFA ». */}
          <span className="numeric text-title-l font-medium">
            {money(balance, { round: true })}
          </span>
        </div>
      </div>
    </Modal>
  )
}
