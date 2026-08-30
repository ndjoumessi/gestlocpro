import { useEffect, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { ChampsApparies, Field } from '@/components/primitives/Field'
import { DatePicker, MonthPicker } from '@/components/primitives/DatePicker'
import { Input, Select, Textarea } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/** Le repli par défaut du mois et du jour, à l'ouverture ET à chaque
    réinitialisation ci-dessous : une seule formule pour les deux moments. */
const moisCourant = () => new Date().toISOString().slice(0, 7)
const jourCourant = () => new Date().toISOString().slice(0, 10)

/** Saisie d'un encaissement. Le règlement partiel est admis par conception. */
export function RecordPaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { money, parseAmount } = useCurrency()
  const { notify } = useToast()
  const { units, recordPayment } = usePortfolio()

  const payable = units.filter((unit) => unit.status !== 'vacant')

  const [unitId, setUnitId] = useState(payable[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mobile')
  /**
   * Mois réglé par ce versement, `AAAA-MM`.
   *
   * Pré-rempli au mois courant — le cas de loin le plus fréquent — mais
   * modifiable, parce que le cas qui compte est l'autre : un versement reçu le
   * 2 août qui règle juillet. Sans ce champ, juillet restait impayé et août
   * apparaissait soldé d'un loyer qu'il n'avait pas reçu. Deux mois faux pour
   * un seul versement.
   */
  const [periode, setPeriode] = useState(moisCourant)
  /**
   * Jour où l'argent a été reçu, `AAAA-MM-JJ`.
   *
   * Distincte de la période : le 2 août, on reçoit le loyer de juillet. La
   * période dit ce que le versement RÈGLE ; cette date dit QUAND il est
   * arrivé. Les confondre, c'est perdre l'une des deux — et c'est la date de
   * réception qui fait foi devant un locataire qui conteste un retard.
   */
  const [verseLe, setVerseLe] = useState(jourCourant)
  /**
   * Référence de la transaction — Mobile Money, virement, chèque.
   *
   * Facultative, et elle doit le rester : un versement en espèces n'en a pas,
   * et l'exiger empêcherait d'enregistrer le cas le plus courant du marché
   * visé. Mais c'est par elle que le versement se retrouve sur un relevé
   * bancaire, et sans elle un rapprochement se fait à la main, ligne à ligne.
   */
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  /*
    UNE ERREUR PAR CHAMP, et non une pour deux.

    Un état unique servait le montant ET la date : refuser une date future
    affichait le motif sous « Montant », qui devenait `aria-invalid` à la
    place du champ fautif. L'utilisateur corrigeait donc ce qui n'avait rien
    et laissait la vraie faute en place. L'écran des cautions tient déjà le
    motif correct, un objet dont chaque clé est un champ.
  */
  const [erreurs, setErreurs] = useState<{ amount?: string; paidOn?: string }>({})

  /**
   * REMISE À ZÉRO À L'OUVERTURE, et non au montage.
   *
   * `Payments` et `Dashboard` gardent cette modale montée en permanence et ne
   * font varier que `open` — à l'inverse de `SettleModal` ou `TariffsModal`,
   * démontées avec leur état à la fermeture. Sans ce repli, un montant refusé
   * restait affiché, message d'erreur compris, à la réouverture suivante —
   * pour un versement sans rapport avec celui qui avait échoué — et l'unité
   * choisie la fois précédente restait sélectionnée en silence : au premier
   * clic sur « Enregistrer », l'argent serait parti sur le bail d'hier.
   */
  useEffect(() => {
    if (!open) return
    setUnitId(payable[0]?.id ?? '')
    setAmount('')
    setMethod('mobile')
    setPeriode(moisCourant())
    setVerseLe(jourCourant())
    setReference('')
    setNote('')
    setErreurs({})
    // `payable` n'entre pas dans les dépendances : on ne réinitialise qu'à
    // l'OUVERTURE, jamais parce que le parc a changé sous une modale ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const unit = units.find((u) => u.id === unitId)

  const submit = () => {
    const parsed = parseAmount(amount)
    if (parsed === null || parsed <= 0) {
      setErreurs({ amount: t('app.payments.amountInvalid') })
      return
    }
    /**
     * Une quittance ATTESTE d'un fait ; la dater en avant en fait une promesse.
     *
     * Une quittance a été émise pour un règlement daté du 17 septembre alors
     * qu'on était le 18 août — le registre portait de l'argent qui n'était pas
     * arrivé. Le serveur refuse désormais en 422 ; la même borne est posée ici
     * pour que le refus arrive avant l'aller-retour.
     */
    if (verseLe && verseLe > new Date().toISOString().slice(0, 10)) {
      setErreurs({ paidOn: t('app.payments.paidInFuture') })
      return
    }
    setErreurs({})

    /**
     * Le versement part RÉELLEMENT au serveur.
     *
     * Cette modale affichait « Paiement enregistré · quittance envoyée » et
     * n'écrivait nulle part. C'est le mensonge le plus coûteux d'un logiciel de
     * gestion : le gestionnaire repart en croyant l'argent tracé, et l'impayé
     * réapparaît le mois suivant sans qu'on puisse dire si le locataire a payé.
     *
     * La période est le mois COURANT, premier jour. C'est le cas de loin le
     * plus fréquent ; imputer sur un autre mois — un versement d'août qui
     * couvre juillet — reste à offrir, et le serveur le sait déjà faire.
     */
    recordPayment(unitId, {
      periodStart: `${periode}-01`,
      amountMinor: parsed,
      method,
      ...(verseLe ? { paidOn: verseLe } : {}),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    })

    onClose()
    notify(t('app.paymentSaved'), { tone: 'ok' })
    setAmount('')
    setReference('')
    setNote('')
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
          <Button type="submit" form="encaissement">{t('common.save')}</Button>
        </>
      }
    >
      {/*
        UN VRAI `<form>`, ET LE BOUTON DU PIED LUI EST RATTACHÉ.

        `Modal` rend le corps et le pied dans deux `<div>` FRÈRES : un `<form>`
        autour du corps ne peut donc pas contenir le bouton du pied — et faute
        de l'avoir résolu, cette modale n'avait pas de formulaire du tout.
        Entrée n'y validait rien.

        Le coût n'est pas seulement au clavier. Sur un clavier virtuel de
        téléphone, un champ hors formulaire perd sa touche d'action « Aller » :
        le clavier reste ouvert par-dessus la barre d'actions, au moment précis
        où il faut l'atteindre.

        L'attribut `form` est fait pour ce cas. `noValidate` l'accompagne
        toujours : sans lui la validation native rouvre ses bulles à côté des
        messages de `Field`, deux refus pour la même faute.
      */}
      <form
        id="encaissement"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label={t('app.payments.selectUnit')} required>
          {(props) => (
            <Select {...props} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {payable.map((u) => (
                <option key={u.id} value={u.id}>
                  {/*
                    Le LIBELLÉ, pas l'identifiant.

                    Cette liste affichait « 5d2665cd-eda5-4d9d-… — BEKONO
                    LANDRY ». Le garde `noTechnicalIds` existe précisément pour
                    ça — son en-tête dit que le produit « a un temps montré
                    l'uuid d'une unité au lieu de son libellé » — et il ne l'a
                    pas vu : il inspecte les écrans AU REPOS, et cette liste ne
                    se peuple qu'une fois la modale ouverte.
                  */}
                  {u.label} — {u.tenant}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* PÉRIODE ET DATE DE VERSEMENT SE LISENT COMME UNE PAIRE : l'une dit
            quel loyer, l'autre quand il est arrivé, et l'écart entre les deux
            est justement ce qu'on vérifie. Appairées, elles rendent 116 px de
            hauteur dès 640 px de fenêtre. */}
        <ChampsApparies>
        <Field label={t('app.payments.period')} hint={t('app.payments.periodHint')} required>
          {(props) => (
            <MonthPicker
              id={props.id}
              aria-describedby={props['aria-describedby']}
              invalid={props['aria-invalid']}
              name="period"
              required
              value={periode}
              onChange={setPeriode}
            />
          )}
        </Field>

        <Field
          label={t('app.payments.paidOn')}
          hint={t('app.payments.paidOnHint')}
          required
          error={erreurs.paidOn}
        >
          {(props) => (
            <DatePicker
              id={props.id}
              aria-describedby={props['aria-describedby']}
              invalid={props['aria-invalid']}
              name="paidOn"
              required
              value={verseLe}
              onChange={setVerseLe}
            />
          )}
        </Field>

        </ChampsApparies>

        {/* MONTANT ET MOYEN : le second qualifie le premier — « 145 000 en
            mobile money » est une seule information en deux champs. */}
        <ChampsApparies>
        <Field
          label={t('app.payments.amount')}
          hint={
            unit
              ? t('app.payments.dueAmount', { amount: money(unit.rent, { compact: true }) })
              : t('app.payments.amountHint')
          }
          required
          error={erreurs.amount}
        >
          {(props) => (
            <Input
              {...props}
              name="amount"
              inputMode="decimal"
              value={amount}
              placeholder={unit ? money(unit.rent, { compact: true, omitSymbol: true }) : ''}
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
        </ChampsApparies>

        <Field
          label={t('app.payments.reference')}
          hint={t('app.payments.referenceHint')}
          optional
        >
          {(props) => (
            <Input
              {...props}
              name="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </Field>
        {/*
          LA NOTE, ET LE LOCATAIRE NE LA LIT PAS.

          `Payment.note` est au schéma depuis l'origine, sans saisie ni lecture :
          le même manque que `withheldReason` sur la caution — le seul texte qui
          expliquerait la ligne six mois plus tard était le seul qu'on ne gardait
          pas. Elle porte ce que la référence ne dit pas : « solde promis le 15 ».

          L'aide dit qu'elle est interne AVANT la frappe, et non après : c'est la
          seule façon d'écrire librement sans se demander qui lira. Le retrait
          réel est fait par le serveur, qui ne la sert pas au locataire — un
          masquage à l'écran laisserait la donnée dans la réponse.
        */}
        <Field label={t('app.payments.note')} hint={t('app.payments.noteHint')} optional>
          {(props) => (
            <Textarea
              {...props}
              name="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
