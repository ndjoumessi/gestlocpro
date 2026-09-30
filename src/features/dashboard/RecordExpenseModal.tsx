import { useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { api, ApiError } from '@/api/client'

/** La forme SERVIE d'une dépense. Déclarée ici, comme `TarifApi` l'est dans sa
    propre modale : elle ne voyage qu'entre cet écran et la sienne. */
export interface DepenseApi {
  id: string
  buildingId: string | null
  unitId: string | null
  category: 'tax' | 'insurance' | 'syndic' | 'utility' | 'upkeep' | 'other'
  label: string
  amountMinor: number
  incurredOn: string
  paidOn: string | null
  note: string | null
}

const FAMILLES = ['tax', 'insurance', 'syndic', 'utility', 'upkeep', 'other'] as const

/**
 * SAISIR OU CORRIGER UNE DÉPENSE — une seule boîte pour les deux gestes.
 *
 * Les champs sont exactement les mêmes ; ce qui change est l'adresse de
 * l'écriture. Deux boîtes jumelles divergeraient au premier ajustement, comme
 * `RecordReadingModal` l'écrit pour les relevés.
 *
 * ═══ CE QUI NE SE CORRIGE PAS, ET POURQUOI C'EST VISIBLE ═══
 *
 * La famille et la portée ne sont pas modifiables en correction : le serveur ne
 * les accepte pas, et déplacer une dépense d'un immeuble à l'autre n'est pas
 * réparer une saisie — c'est en inventer une autre. Les deux champs sont donc
 * RENDUS INERTES plutôt que masqués : les cacher laisserait croire qu'une
 * dépense n'a pas de portée, et l'utilisateur chercherait où elle est passée.
 */
export function RecordExpenseModal({
  onClose,
  onEcrit,
  aCorriger,
}: {
  onClose: () => void
  onEcrit: () => void
  aCorriger?: DepenseApi
}) {
  const t = useT()
  const { definition, parseAmount, enDeviseAffichee } = useCurrency()
  const { buildings, units } = usePortfolio()
  const { adhesionActive } = useSession()
  const { notify } = useToast()
  const parkId = adhesionActive?.parkId ?? null

  const [category, setCategory] = useState<DepenseApi['category']>(aCorriger?.category ?? 'tax')
  const [label, setLabel] = useState(aCorriger?.label ?? '')
  const [montant, setMontant] = useState(
    aCorriger ? String(enDeviseAffichee(aCorriger.amountMinor)) : '',
  )
  const [incurredOn, setIncurredOn] = useState(aCorriger?.incurredOn ?? '')
  const [paidOn, setPaidOn] = useState(aCorriger?.paidOn ?? '')
  /** `''` = le parc entier ; `b:<id>` = un immeuble ; `u:<id>` = un logement. */
  const [portee, setPortee] = useState(
    aCorriger?.buildingId
      ? `b:${aCorriger.buildingId}`
      : aCorriger?.unitId
        ? `u:${aCorriger.unitId}`
        : '',
  )
  const [note, setNote] = useState(aCorriger?.note ?? '')
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function enregistrer() {
    const suivant: Record<string, string | undefined> = {}
    if (!label.trim()) suivant.label = t('app.expenseEntry.labelRequired')
    const minor = parseAmount(montant)
    if (montant.trim() === '') suivant.amountMinor = t('app.expenseEntry.amountRequired')
    else if (minor === null || minor <= 0)
      suivant.amountMinor = t('app.expenseEntry.amountInvalid')
    if (!incurredOn) suivant.incurredOn = t('app.expenseEntry.incurredOnRequired')
    setErreurs(suivant)

    if (Object.values(suivant).some(Boolean)) {
      /* `data-champ` AVANT `[name=]` : un `Combobox` porte son `name` sur un
         champ caché, que l'on ne peut pas focaliser. */
      const premier = (['label', 'amountMinor', 'incurredOn'] as const).find((c) => suivant[c])
      if (premier)
        formRef.current
          ?.querySelector<HTMLElement>(
            `[data-champ="${premier}"], [name="${premier}"]:not([type="hidden"])`,
          )
          ?.focus()
      return
    }

    if (!parkId) {
      /* HORS SESSION — la démonstration n'écrit rien. On le DIT plutôt que de
         feindre un succès : un état qui ne bouge pas après un enregistrement
         réussi se lit comme une panne. */
      notify(t('app.expenseEntry.failed'), { tone: 'danger' })
      onClose()
      return
    }

    setEnCours(true)
    try {
      if (aCorriger) {
        await api.updateExpense(parkId, aCorriger.id, {
          label: label.trim(),
          amountMinor: minor!,
          incurredOn,
          paidOn: paidOn || null,
          note: note.trim() || null,
        })
        notify(t('app.expenseEntry.corrected'))
      } else {
        await api.recordExpense(parkId, {
          category,
          label: label.trim(),
          amountMinor: minor!,
          incurredOn,
          paidOn: paidOn || null,
          buildingId: portee.startsWith('b:') ? portee.slice(2) : null,
          unitId: portee.startsWith('u:') ? portee.slice(2) : null,
          note: note.trim() || null,
        })
        notify(t('app.expenseEntry.saved'))
      }
      onEcrit()
      onClose()
    } catch (erreur) {
      /* 404 SUR UNE ÉCRITURE VEUT DIRE « HORS PÉRIMÈTRE », et non « introuvable » :
         le serveur refuse par 404 plutôt que par 403 pour ne pas confirmer
         l'existence de l'immeuble qu'il cache. L'écran le traduit en mots
         d'utilisateur, faute de quoi « introuvable » désignerait la dépense
         qu'on est en train de créer. */
      if (erreur instanceof ApiError && erreur.status === 404)
        notify(t('app.expenseEntry.outOfScope'), { tone: 'danger' })
      else notify(t('app.expenseEntry.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t(aCorriger ? 'app.expenseEntry.correctTitle' : 'app.expenseEntry.title')}
      description={t('app.expenseEntry.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button type="submit" form="depense" loading={enCours}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        id="depense"
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          void enregistrer()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label={t('app.expenseEntry.category')} required>
          {(props) => (
            <Combobox
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="category"
              autoComplete="off"
              ouvrirAuFocus={false}
              disabled={aCorriger !== undefined}
              value={category}
              onChange={(v) => setCategory(v as DepenseApi['category'])}
              options={FAMILLES.map((f) => ({
                value: f,
                label: t(`app.expenses.category.${f}` as 'app.expenses.category.tax'),
              }))}
            />
          )}
        </Field>

        <Field
          label={t('app.expenseEntry.label')}
          hint={t('app.expenseEntry.labelHint')}
          required
          error={erreurs.label}
        >
          {(props) => (
            <Input {...props} data-champ="label" value={label} onChange={(e) => setLabel(e.target.value)} />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t('app.expenseEntry.amount', { devise: definition.symbol })}
            required
            error={erreurs.amountMinor}
          >
            {(props) => (
              <Input
                {...props}
                data-champ="amountMinor"
                inputMode="numeric"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
            )}
          </Field>

          <Field
            label={t('app.expenseEntry.incurredOn')}
            hint={t('app.expenseEntry.incurredOnHint')}
            required
            error={erreurs.incurredOn}
          >
            {(props) => (
              <DatePicker
                id={props.id}
                aria-describedby={props['aria-describedby']}
                invalid={props['aria-invalid']}
                name="incurredOn"
                value={incurredOn}
                onChange={setIncurredOn}
              />
            )}
          </Field>
        </div>

        <Field label={t('app.expenseEntry.paidOn')} hint={t('app.expenseEntry.paidOnHint')} optional>
          {(props) => (
            <DatePicker
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="paidOn"
              value={paidOn}
              onChange={setPaidOn}
            />
          )}
        </Field>

        <Field label={t('app.expenseEntry.scope')} hint={t('app.expenseEntry.scopeHint')} optional>
          {(props) => (
            <Combobox
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="portee"
              autoComplete="off"
              ouvrirAuFocus={false}
              disabled={aCorriger !== undefined}
              value={portee}
              onChange={setPortee}
              options={[
                { value: '', label: t('app.expenseEntry.scopePark') },
                ...buildings.map((b) => ({ value: `b:${b.id}`, label: b.name })),
                ...units.map((u) => ({ value: `u:${u.id}`, label: u.label })),
              ]}
            />
          )}
        </Field>

        <Field label={t('app.expenseEntry.note')} optional>
          {(props) => (
            <Input {...props} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  )
}
