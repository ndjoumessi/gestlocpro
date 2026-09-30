import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { DatePicker, MonthPicker } from '@/components/primitives/DatePicker'
import { Notice } from '@/components/primitives/Notice'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { api, ApiError } from '@/api/client'
import { MOIS_DEMO } from '@/data/portfolio'

/** Les trois bases, lues par la modale et par la garde des valeurs affichées. */
const BASES = ['percentOfCollected', 'fixedPerUnit', 'fixedPerMonth'] as const
type Base = (typeof BASES)[number]

interface BaremeApi {
  basis: Base
  rateBasisPoints: number | null
  fixedMinor: number | null
  currency: string
  startsOn: string
  endsOn: string | null
}

interface ReleveApi {
  fee: BaremeApi | null
  collectedMinor: number
  expensesMinor: number
  worksMinor: number
  feeMinor: number
  netMinor: number
  managedUnits: number
}

/**
 * HONORAIRES ET COMPTE-RENDU DE GESTION, sur la ligne d'un gestionnaire.
 *
 * ═══ POURQUOI UNE MODALE D'`ACCÈS` ET NON UN ÉCRAN ═══
 *
 * Le barème appartient au MANDAT, et le mandat vit déjà sur cet écran — c'est
 * lui qui confie les immeubles et qui révoque. Un écran séparé aurait obligé à
 * choisir un gestionnaire avant de rien voir, c'est-à-dire à refaire la liste
 * qui est déjà là.
 *
 * ═══ LE TAUX EST EN POUR CENT ICI, EN POINTS DE BASE EN BASE ═══
 *
 * L'utilisateur tape « 8,5 » ; le serveur reçoit 850. La conversion vit à cet
 * endroit unique, et aucun flottant ne survit à l'envoi : `Math.round(x * 100)`
 * sur une décimale au plus. Laisser passer un flottant jusqu'à la base ferait
 * exactement ce que l'en-tête du schéma interdit.
 *
 * ═══ LE RELEVÉ NE S'ENREGISTRE PAS ═══
 *
 * Il se lit. Aucun bouton ne l'émet, aucune ligne ne le stocke : quatre sommes
 * en base seraient quatre compteurs libres de diverger des paiements et des
 * dépenses qu'ils résument. Le figer viendra le jour où il faudra rééditer un
 * relevé passé — et ce jour-là ce sera un instantané, comme `RentCharge` fige
 * son loyer.
 */
export function FeesModal({
  membershipId,
  nom,
  onClose,
}: {
  membershipId: string
  nom: string
  onClose: () => void
}) {
  const t = useT()
  const { money, definition, parseAmount, enDeviseAffichee } = useCurrency()
  const { adhesionActive } = useSession()
  const { notify } = useToast()
  const parkId = adhesionActive?.parkId ?? null

  const [basis, setBasis] = useState<Base>('percentOfCollected')
  const [taux, setTaux] = useState('')
  const [forfait, setForfait] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [mois, setMois] = useState(MOIS_DEMO)
  const [releve, setReleve] = useState<ReleveApi | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  /* LE RETRAIT EN DEUX TEMPS, dans la boîte : `Modal` ne s'imbrique pas
     proprement, et `clavierDesModales` exige d'ouvrir, tenir, fermer et RENDRE
     le focus à chaque niveau. */
  const [confirmeRetrait, setConfirmeRetrait] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const bornesDuMois = useCallback((moisChoisi: string) => {
    const [an, m] = moisChoisi.split('-').map(Number) as [number, number]
    /* Le dernier jour par le jour zéro du suivant, en UTC comme les colonnes. */
    const dernier = new Date(Date.UTC(an, m, 0)).getUTCDate()
    return { from: `${moisChoisi}-01`, to: `${moisChoisi}-${String(dernier).padStart(2, '0')}` }
  }, [])

  useEffect(() => {
    if (!parkId) return
    let annule = false
    const { from, to } = bornesDuMois(mois)
    void api
      .statement<ReleveApi>(parkId, membershipId, from, to)
      .then((lu) => {
        if (annule) return
        setReleve(lu)
        if (lu.fee) {
          setBasis(lu.fee.basis)
          setTaux(lu.fee.rateBasisPoints !== null ? String(lu.fee.rateBasisPoints / 100) : '')
          setForfait(
            lu.fee.fixedMinor !== null ? String(enDeviseAffichee(lu.fee.fixedMinor)) : '',
          )
          setStartsOn(lu.fee.startsOn)
          setEndsOn(lu.fee.endsOn ?? '')
        }
      })
      .catch(() => {
        /* UNE LECTURE QUI ÉCHOUE NE LAISSE PAS LE RELEVÉ PRÉCÉDENT : des sommes
           d'un autre mois sous l'étiquette de celui-ci seraient un chiffre faux
           présenté comme un fait. */
        if (!annule) setReleve(null)
      })
    return () => {
      annule = true
    }
  }, [parkId, membershipId, mois, bornesDuMois, enDeviseAffichee])

  async function enregistrer() {
    const suivant: Record<string, string | undefined> = {}
    /* LE TAUX N'ACCEPTE QU'UNE DÉCIMALE, et c'est ce qui garantit l'entier en
       base : `Math.round(8.5 * 100)` vaut 850 exactement, `Math.round(8.55 *
       100)` vaudrait 855 en perdant une précision qu'on aurait promise. */
      const enPoints =
      taux.trim() === '' ? null : Math.round(Number(taux.replace(',', '.')) * 100)
    const enForfait = forfait.trim() === '' ? null : parseAmount(forfait)

    if (basis === 'percentOfCollected') {
      if (enPoints === null) suivant.taux = t('app.fees.rateRequired')
      else if (!Number.isFinite(enPoints) || enPoints < 1 || enPoints > 10000)
        suivant.taux = t('app.fees.rateInvalid')
    } else if (enForfait === null || enForfait <= 0) {
      suivant.forfait = t('app.fees.fixedRequired')
    }
    if (!startsOn) suivant.startsOn = t('app.fees.rateRequired')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['taux', 'forfait', 'startsOn'] as const).find((c) => suivant[c])
      if (premier)
        formRef.current
          ?.querySelector<HTMLElement>(`[data-champ="${premier}"], [name="${premier}"]`)
          ?.focus()
      return
    }

    if (!parkId) {
      notify(t('app.fees.failed'), { tone: 'danger' })
      onClose()
      return
    }

    setEnCours(true)
    try {
      await api.setFee(parkId, membershipId, {
        basis,
        /* LA BASE COMMANDE LEQUEL DES DEUX PART, et l'autre part à `null` — le
           serveur refuse un barème qui porterait les deux. */
        rateBasisPoints: basis === 'percentOfCollected' ? enPoints : null,
        fixedMinor: basis === 'percentOfCollected' ? null : enForfait,
        startsOn,
        endsOn: endsOn || null,
      })
      notify(t('app.fees.saved'))
      const { from, to } = bornesDuMois(mois)
      setReleve(await api.statement<ReleveApi>(parkId, membershipId, from, to))
    } catch (erreur) {
      if (!(erreur instanceof ApiError)) throw erreur
      notify(t('app.fees.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  async function retirerLeBareme() {
    if (!parkId) {
      setConfirmeRetrait(false)
      return
    }
    setEnCours(true)
    try {
      await api.deleteFee(parkId, membershipId)
      notify(t('app.fees.removedFee'))
      const { from, to } = bornesDuMois(mois)
      setReleve(await api.statement<ReleveApi>(parkId, membershipId, from, to))
      /* LE FORMULAIRE REPART À VIDE : laisser le taux affiché après un retrait
         ferait croire qu'un barème court encore. */
      setTaux('')
      setForfait('')
      setEndsOn('')
    } catch (erreur) {
      if (!(erreur instanceof ApiError)) throw erreur
      notify(t('app.fees.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
      setConfirmeRetrait(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('app.fees.openLine', { name: nom })}
      description={t('app.fees.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {/* LE RETRAIT N'EST OFFERT QUE S'IL Y A QUELQUE CHOSE À RETIRER, et en
              deux temps — un barème retiré change tous les relevés suivants. */}
          {releve?.fee &&
            (confirmeRetrait ? (
              <Button variant="danger" loading={enCours} onClick={() => void retirerLeBareme()}>
                {t('app.fees.confirmRemoveFee')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmeRetrait(true)}>
                {t('app.fees.removeFee')}
              </Button>
            ))}
          <Button type="submit" form="bareme" loading={enCours}>
            {t('app.fees.save')}
          </Button>
        </>
      }
    >
      <form
        id="bareme"
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          void enregistrer()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label={t('app.fees.basisLabel')} required>
          {(props) => (
            <Combobox
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="basis"
              autoComplete="off"
              ouvrirAuFocus={false}
              value={basis}
              onChange={(v) => setBasis(v as Base)}
              options={BASES.map((b) => ({
                value: b,
                label: t(`app.fees.basis.${b}` as 'app.fees.basis.percentOfCollected'),
              }))}
            />
          )}
        </Field>

        {basis === 'percentOfCollected' ? (
          <Field
            label={t('app.fees.rate')}
            hint={t('app.fees.rateHint')}
            required
            error={erreurs.taux}
          >
            {(props) => (
              <Input
                {...props}
                data-champ="taux"
                inputMode="decimal"
                value={taux}
                onChange={(e) => setTaux(e.target.value)}
              />
            )}
          </Field>
        ) : (
          <Field
            label={t('app.fees.fixed', { devise: definition.symbol })}
            required
            error={erreurs.forfait}
          >
            {(props) => (
              <Input
                {...props}
                data-champ="forfait"
                inputMode="numeric"
                value={forfait}
                onChange={(e) => setForfait(e.target.value)}
              />
            )}
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('app.fees.startsOn')} required error={erreurs.startsOn}>
            {(props) => (
              <DatePicker
                id={props.id}
                aria-describedby={props['aria-describedby']}
                invalid={props['aria-invalid']}
                name="startsOn"
                value={startsOn}
                onChange={setStartsOn}
              />
            )}
          </Field>
          <Field label={t('app.fees.endsOn')} hint={t('app.fees.endsOnHint')} optional>
            {(props) => (
              <DatePicker
                id={props.id}
                aria-describedby={props['aria-describedby']}
                name="endsOn"
                value={endsOn}
                onChange={setEndsOn}
              />
            )}
          </Field>
        </div>
      </form>

      <div className="mt-6 border-t border-divider pt-5">
        <h3 className="title-m">{t('app.fees.statement')}</h3>

        {/* LE SÉLECTEUR N'EXISTE QU'EN SESSION : la démonstration ne peut pas
            relire le serveur, et un sélecteur qui ne déplace rien se lit comme
            une panne. Même règle que l'écran des dépenses. */}
        {parkId && (
          <div className="mt-3 max-w-40">
            <MonthPicker
              aria-label={t('app.fees.periodShown')}
              name="moisDuReleve"
              value={mois}
              onChange={setMois}
            />
          </div>
        )}

        {releve === null ? (
          <p className="text-body text-muted mt-3">{t('app.fees.noFeeHint')}</p>
        ) : (
          <>
            <dl className="mt-4 flex flex-col gap-2">
              {(
                [
                  ['app.fees.collected', releve.collectedMinor],
                  ['app.fees.expensesOut', releve.expensesMinor],
                  ['app.fees.worksOut', releve.worksMinor],
                  ['app.fees.feeDue', releve.feeMinor],
                ] as const
              ).map(([cle, valeur]) => (
                <div key={cle} className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-muted">{t(cle)}</dt>
                  <dd className="mono-data">{money(valeur)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 border-t border-divider pt-2">
                {/* `title-m` ET NON `text-body font-semibold` : le rôle existe pour
                    remplacer exactement cette paire, et `graisses` la refuse. */}
                <dt className="title-m">{t('app.fees.net')}</dt>
                <dd className="mono-data font-semibold">{money(releve.netMinor)}</dd>
              </div>
            </dl>

            <p className="text-body-s text-muted mt-2">{t('app.fees.collectedHint')}</p>

            {/* LE NET NÉGATIF SE DIT EN MOTS, pas seulement par un signe moins :
                un montant négatif seul se lirait comme un défaut d'affichage. */}
            {releve.netMinor < 0 && (
              <Notice tone="warn" titre={t('app.fees.netNegative')} className="mt-4">
                {t('app.fees.netNegativeHint')}
              </Notice>
            )}

            {/* SANS BARÈME, LE RELEVÉ RESTE JUSTE — il ne retient rien. On le dit
                plutôt que de laisser lire « 0 » comme un calcul. */}
            {releve.fee === null && (
              <Notice tone="neutral" titre={t('app.fees.noFee')} className="mt-4">
                {t('app.fees.noFeeHint')}
              </Notice>
            )}

            {basis === 'fixedPerUnit' && (
              <p className="text-body-s text-muted mt-3">
                {t('app.fees.managedUnits')} · {releve.managedUnits}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
