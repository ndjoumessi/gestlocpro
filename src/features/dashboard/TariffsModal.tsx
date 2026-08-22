import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useSession } from '@/api/SessionProvider'
import { ApiError, api } from '@/api/client'

/** `AAAA-MM-JJ` en parties, pour le formateur de dates du produit — la même
    conversion que `ReceiptModal`, qui reçoit la même forme du serveur. */
const partsDe = (iso: string) => {
  const [y, m, j] = iso.split('-').map(Number)
  return { year: y!, month: m!, day: j! }
}

interface TarifApi {
  id: string
  utility: 'water' | 'power'
  unitPriceMinor: number
  effectiveFrom: string
}

/**
 * LES PRIX DE REFACTURATION, saisis par celui qui les décide.
 *
 * Deux constantes du client tenaient ce rôle — 520 le mètre cube, 99 le
 * kilowattheure — affichées à tous les parcs sans que personne ne les ait
 * saisies. Le serveur sait maintenant les stocker, datés et par parc ; il ne
 * manquait que l'endroit où les poser, et un propriétaire devait en passer par
 * `curl`.
 *
 * Un prix n'est jamais MODIFIÉ : on en pose un nouveau, avec sa date d'effet.
 * C'est ce que le schéma impose et c'est ce qui est juste — corriger le prix de
 * janvier en juin réécrirait des quittances déjà remises. L'historique reste
 * lisible en dessous, parce que c'est lui qui explique une facture ancienne.
 */
export function TariffsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const d = useDates()
  const { money, parseAmount } = useCurrency()
  const { notify } = useToast()
  /*
    LE REFUS LOCAL VIT SOUS SON CHAMP, et non dans un toast.

    Un toast s'efface au bout de quelques secondes pendant que le champ garde
    la valeur refusée : l'utilisateur relit un prix qui semble accepté, sans
    plus rien pour dire ce qu'on lui reproche. La modale d'ajout d'unité
    tient déjà le motif correct. Les échecs SERVEUR restent au toast — eux ne
    désignent aucun champ.
  */
  const [erreurPrix, setErreurPrix] = useState<string | undefined>(undefined)
  const { adhesionActive } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [tarifs, setTarifs] = useState<TarifApi[]>([])
  const [utility, setUtility] = useState<'water' | 'power'>('water')
  const [prix, setPrix] = useState('')
  /**
   * Le PREMIER du mois courant par défaut, et non aujourd'hui.
   *
   * La refacturation est mensuelle : un prix qui prend effet le 17 laisserait la
   * période en cours à cheval sur deux tarifs, sans que rien à l'écran ne dise
   * lequel s'applique. Le premier du mois est la date que le propriétaire aurait
   * saisie de toute façon, et il reste libre d'en mettre une autre.
   */
  const [effet, setEffet] = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (!open || !parkId) return
    void api
      .tariffs<{ tariffs: TarifApi[] }>(parkId)
      .then((r) => setTarifs(r.tariffs))
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
  }, [open, parkId, notify, t])

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    if (!parkId) return
    // Un prix unitaire est un montant : il se lit comme les autres. `Number`
    // refusait « 1 250 » recopié depuis l'historique affiché juste en dessous —
    // le produit rejetait la forme qu'il venait lui-même d'imprimer.
    const valeur = parseAmount(prix)
    // `null` d'abord et à part : `Number.isInteger(null)` est faux, mais s'en
    // remettre à cette coïncidence confondrait l'illisible avec le prix
    // décimal, deux refus qui n'ont ni la même cause ni le même remède.
    if (valeur === null || !Number.isInteger(valeur) || valeur <= 0) {
      setErreurPrix(t('app.tariffs.priceInvalid'))
      return
    }
    setErreurPrix(undefined)

    setEnvoi(true)
    void api
      .setTariff<{ tariff: TarifApi }>(parkId, {
        utility,
        unitPriceMinor: valeur,
        effectiveFrom: effet,
      })
      .then((r) => {
        setTarifs((liste) => [r.tariff, ...liste])
        setPrix('')
        notify(t('app.tariffs.saved'), { tone: 'ok' })
      })
      .catch((err: unknown) => {
        // Le 409 a une cause précise et un remède précis — changer la date ou
        // corriger celle qui existe. Le confondre avec une panne obligerait à
        // deviner.
        if (err instanceof ApiError && err.status === 409) {
          notify(t('app.tariffs.duplicate'), { tone: 'danger' })
        } else {
          notify(t('common.actionFailed'), { tone: 'danger' })
        }
      })
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.tariffs.title')}
      description={t('app.tariffs.description')}
      /*
        UNE SEULE ACTION PRIMAIRE, et ce n'était pas la bonne.

        `Button` rend « primaire » par défaut : ce « Fermer » était donc en
        encre pleine, dans la barre épinglée qui ne défile jamais — le bouton le
        plus fort de l'écran était celui qui abandonne. Le vrai geste,
        « Enregistrer ce prix », vivait dans le corps défilant, et pouvait se
        trouver hors champ au moment où l'on cherche à valider.

        Le fichier du composant porte la règle en toutes lettres, juste
        au-dessus de la variante concernée : « Une seule action primaire par
        écran. »

        L'enregistrement remonte au pied par l'attribut `form`, le formulaire
        étant déjà écrit dans le corps — c'est ce que les deux modales voisines
        viennent d'adopter.
      */
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button type="submit" form="tarif" loading={envoi}>
            {t('app.tariffs.submit')}
          </Button>
        </>
      }
    >
      <form id="tarif" onSubmit={enregistrer} noValidate className="flex flex-col gap-5">
        <Field label={t('app.tariffs.utility')} required>
          {(props) => (
            <Select
              {...props}
              name="utility"
              value={utility}
              onChange={(e) => setUtility(e.target.value as 'water' | 'power')}
            >
              <option value="water">{t('app.meters.water')}</option>
              <option value="power">{t('app.meters.power')}</option>
            </Select>
          )}
        </Field>

        <Field
          label={t('app.tariffs.price')}
          hint={t('app.tariffs.priceHint')}
          required
          error={erreurPrix}
        >
          {(props) => (
            <Input
              {...props}
              name="unitPriceMinor"
              inputMode="numeric"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
            />
          )}
        </Field>

        <Field label={t('app.tariffs.effectiveFrom')} hint={t('app.tariffs.effectiveFromHint')} required>
          {(props) => (
            <Input
              {...props}
              name="effectiveFrom"
              type="date"
              value={effet}
              onChange={(e) => setEffet(e.target.value)}
            />
          )}
        </Field>

      </form>

      <div className="mt-6 border-t border-divider pt-5">
        <p className="eyebrow text-muted">{t('app.tariffs.historyTitle')}</p>
        {tarifs.length === 0 ? (
          /* Un parc sans prix n'affiche aucun montant : on le dit ici plutôt que
             de laisser une liste vide sans explication. */
          <p className="mt-3 flex items-start gap-2 text-body text-muted">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {t('app.tariffs.empty')}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tarifs.map((tarif) => (
              <li key={tarif.id} className="flex items-baseline justify-between gap-3 text-body">
                <span>
                  {t(`app.meters.${tarif.utility}` as 'app.meters.water')}
                  {' · '}
                  {/* La date brute du serveur, « 2026-08-01 », ne se lit ni en
                      français ni en anglais : chaque autre écran de ce
                      périmètre passe par `useDates`, celui-ci l'affichait
                      encore tel quel. */}
                  <span className="text-muted">{d.fullDate(partsDe(tarif.effectiveFrom))}</span>
                </span>
                <span className="numeric font-medium">
                  {money(tarif.unitPriceMinor, { round: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
