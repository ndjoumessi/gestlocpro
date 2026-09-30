import { useState, type ChangeEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { DatePicker } from '@/components/primitives/DatePicker'
import { StatusPill } from '@/components/primitives/StatusPill'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { api, ApiError } from '@/api/client'

export interface CandidatApi {
  id: string
  fullName: string
  phoneE164: string | null
  email: string | null
  note: string | null
  status: 'received' | 'visited' | 'accepted' | 'declined'
  appliedOn: string
}

export interface AnnonceApi {
  id: string
  unitId: string
  rentMinor: number
  depositMinor: number
  availableFrom: string
  description: string | null
  status: 'draft' | 'published' | 'closed'
  applicants: CandidatApi[]
}

const SUITES = ['received', 'visited', 'accepted', 'declined'] as const

/**
 * OUVRIR UNE ANNONCE, OU SUIVRE SES CANDIDATS — une seule boîte pour les deux.
 *
 * `annonce` absente : on en ouvre une. Présente : on la suit. Les deux gestes
 * appartiennent au même objet et se succèdent dans le temps ; deux boîtes
 * jumelles auraient divergé au premier ajustement, comme `RecordExpenseModal`
 * l'écrit pour la saisie et la correction d'une dépense.
 *
 * ═══ CE QUE CETTE BOÎTE NE PROPOSE PAS ═══
 *
 * DE SUPPRIMER UN CANDIDAT. « Il n'a jamais postulé » et « on lui a dit non »
 * ne sont pas la même réponse à lui faire trois semaines plus tard, et c'est
 * l'état `declined` qui les sépare. Une suppression effacerait la question.
 *
 * DE CRÉER LE LOCATAIRE depuis un candidat accepté. Le geste est réel et il
 * viendra, mais il engage un bail : une caution, une date de début, un loyer qui
 * peut différer de celui demandé. Le faire ici en un clic poserait tout cela
 * sans le montrer, et l'écran des locataires le demande déjà, champ par champ.
 */
export function ListingModal({
  annonce,
  logementsVides,
  onClose,
  onEcrit,
}: {
  annonce: AnnonceApi | null
  logementsVides: { id: string; libelle: string; loyer: number }[]
  onClose: () => void
  onEcrit: () => void
}) {
  const t = useT()
  const { money, parseAmount, enDeviseAffichee } = useCurrency()
  const { adhesionActive } = useSession()
  const { notify } = useToast()
  const parkId = adhesionActive?.parkId ?? null

  const [unitId, setUnitId] = useState(logementsVides[0]?.id ?? '')
  /* LE LOYER DU LOGEMENT EN PROPOSITION, et non en valeur imposée : on remet
     souvent à un autre prix — le marché a bougé, le logement a été refait —, et
     un champ vide obligerait à le retrouver ailleurs. */
  const [loyer, setLoyer] = useState(
    logementsVides[0] ? String(enDeviseAffichee(logementsVides[0].loyer)) : '',
  )
  const [caution, setCaution] = useState('')
  const [aPartirDu, setAPartirDu] = useState('')
  const [texte, setTexte] = useState('')

  const [nomDuCandidat, setNomDuCandidat] = useState('')
  const [telDuCandidat, setTelDuCandidat] = useState('')
  const [courrielDuCandidat, setCourrielDuCandidat] = useState('')
  const [venuLe, setVenuLe] = useState('')
  const [enCours, setEnCours] = useState(false)

  function horsSession() {
    /* HORS SESSION — la démonstration n'écrit rien. On le DIT plutôt que de
       feindre un succès : un état qui ne bouge pas après un enregistrement
       réussi se lit comme une panne. */
    notify(t('app.vacancy.failed'), { tone: 'danger' })
    onClose()
  }

  async function ouvrirLAnnonce() {
    const loyerMinor = parseAmount(loyer)
    const cautionMinor = parseAmount(caution)
    if (!unitId || loyerMinor === null || loyerMinor <= 0 || !aPartirDu) {
      notify(t('app.vacancy.listingIncomplete'), { tone: 'danger' })
      return
    }
    if (!parkId) return horsSession()

    setEnCours(true)
    try {
      await api.openListing(parkId, unitId, {
        rentMinor: loyerMinor,
        depositMinor: cautionMinor ?? 0,
        availableFrom: aPartirDu,
        description: texte.trim() || null,
      })
      onEcrit()
      notify(t('app.vacancy.listingOpened'))
      onClose()
    } catch (erreur) {
      notify(
        erreur instanceof ApiError && erreur.code === 'logement_occupe'
          ? t('app.vacancy.unitOccupied')
          : t('app.vacancy.failed'),
        { tone: 'danger' },
      )
    } finally {
      setEnCours(false)
    }
  }

  async function changerLEtat(status: 'draft' | 'published' | 'closed') {
    if (!annonce) return
    if (!parkId) return horsSession()
    setEnCours(true)
    try {
      await api.setListingStatus(parkId, annonce.id, status)
      onEcrit()
      notify(t('app.vacancy.listingUpdated'))
      onClose()
    } catch {
      notify(t('app.vacancy.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  async function poserLeCandidat() {
    if (!annonce) return
    if (!nomDuCandidat.trim() || !venuLe) {
      notify(t('app.vacancy.applicantIncomplete'), { tone: 'danger' })
      return
    }
    if (!telDuCandidat.trim() && !courrielDuCandidat.trim()) {
      /* CE QUI MANQUE EST DIT, pas seulement refusé : un candidat qu'on ne peut
         pas rappeler n'est pas un candidat. */
      notify(t('app.vacancy.applicantNeedsReach'), { tone: 'danger' })
      return
    }
    if (!parkId) return horsSession()

    setEnCours(true)
    try {
      await api.addApplicant(parkId, annonce.id, {
        fullName: nomDuCandidat.trim(),
        phoneE164: telDuCandidat.trim() || null,
        email: courrielDuCandidat.trim() || null,
        appliedOn: venuLe,
      })
      setNomDuCandidat('')
      setTelDuCandidat('')
      setCourrielDuCandidat('')
      onEcrit()
      notify(t('app.vacancy.applicantAdded'))
    } catch {
      notify(t('app.vacancy.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  async function suivreLeCandidat(id: string, status: CandidatApi['status']) {
    if (!parkId) return horsSession()
    setEnCours(true)
    try {
      await api.setApplicantStatus(parkId, id, { status })
      onEcrit()
    } catch {
      notify(t('app.vacancy.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t(annonce ? 'app.vacancy.followTitle' : 'app.vacancy.openTitle')}
      description={t('app.vacancy.modalDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {!annonce && (
            <Button type="submit" form="annonce" loading={enCours}>
              {t('app.vacancy.openCta')}
            </Button>
          )}
          {annonce && annonce.status !== 'published' && (
            <Button loading={enCours} onClick={() => void changerLEtat('published')}>
              {t('app.vacancy.publish')}
            </Button>
          )}
          {annonce && annonce.status !== 'closed' && (
            <Button variant="secondary" loading={enCours} onClick={() => void changerLEtat('closed')}>
              {t('app.vacancy.close')}
            </Button>
          )}
        </>
      }
    >
      {!annonce && (
        <form
          id="annonce"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void ouvrirLAnnonce()
          }}
        >
          <Field label={t('app.vacancy.unit')} hint={t('app.vacancy.unitHint')}>
            {(props) => (
              <Select
                {...props}
                name="unitId"
                value={unitId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setUnitId(e.target.value)}
              >
                {logementsVides.length === 0 && (
                  <option value="">{t('app.vacancy.noEmptyUnit')}</option>
                )}
                {logementsVides.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.libelle}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* LE LOYER DEMANDÉ, ET CE QU'IL NE TOUCHE PAS. L'aide le dit parce
              que la crainte est réelle : on hésite à écrire un autre prix si
              l'on croit écraser la référence du logement. */}
          <Field label={t('app.vacancy.rent')} hint={t('app.vacancy.rentHint')}>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={loyer}
                onChange={(e) => setLoyer(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('app.vacancy.deposit')} optional>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={caution}
                onChange={(e) => setCaution(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('app.vacancy.availableFrom')} hint={t('app.vacancy.availableFromHint')}>
            {(props) => (
              <DatePicker
                id={props.id}
                aria-describedby={props['aria-describedby']}
                name="availableFrom"
                value={aPartirDu}
                onChange={setAPartirDu}
              />
            )}
          </Field>

          <Field label={t('app.vacancy.description')} optional>
            {(props) => (
              <Input {...props} value={texte} onChange={(e) => setTexte(e.target.value)} />
            )}
          </Field>
        </form>
      )}

      {annonce && (
        <div className="space-y-4">
          <p className="text-body">
            {t('app.vacancy.askingLine', {
              rent: money(annonce.rentMinor),
              deposit: money(annonce.depositMinor),
            })}
          </p>

          <h3 className="title-m">{t('app.vacancy.applicantsTitle')}</h3>
          {annonce.applicants.length === 0 && (
            <p className="text-body text-muted">{t('app.vacancy.applicantsNone')}</p>
          )}
          <ul className="space-y-3">
            {annonce.applicants.map((c) => (
              <li key={c.id} className="border-s-2 border-subtle ps-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.fullName}</span>
                  <StatusPill tone={c.status === 'accepted' ? 'ok' : 'neutral'} size="sm">
                    {t(`app.vacancy.applicant_${c.status}` as 'app.vacancy.applicant_received')}
                  </StatusPill>
                </span>
                <span className="text-caption text-muted block">
                  {[c.phoneE164, c.email].filter(Boolean).join(' · ')}
                </span>
                <Field label={t('app.vacancy.applicantFollow', { name: c.fullName })}>
                  {(props) => (
                    <Select
                      {...props}
                      name={`suite-${c.id}`}
                      value={c.status}
                      disabled={enCours}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        void suivreLeCandidat(c.id, e.target.value as CandidatApi['status'])
                      }
                    >
                      {SUITES.map((s) => (
                        <option key={s} value={s}>
                          {t(`app.vacancy.applicant_${s}` as 'app.vacancy.applicant_received')}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </li>
            ))}
          </ul>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void poserLeCandidat()
            }}
          >
            <Field label={t('app.vacancy.applicantName')}>
              {(props) => (
                <Input
                  {...props}
                  value={nomDuCandidat}
                  onChange={(e) => setNomDuCandidat(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('app.vacancy.applicantPhone')} hint={t('app.vacancy.applicantReachHint')}>
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={telDuCandidat}
                  onChange={(e) => setTelDuCandidat(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('app.vacancy.applicantEmail')} optional>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={courrielDuCandidat}
                  onChange={(e) => setCourrielDuCandidat(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('app.vacancy.applicantOn')}>
              {(props) => (
                <DatePicker
                  id={props.id}
                  aria-describedby={props['aria-describedby']}
                  name="appliedOn"
                  value={venuLe}
                  onChange={setVenuLe}
                />
              )}
            </Field>
            <Button type="submit" loading={enCours}>
              {t('app.vacancy.applicantAdd')}
            </Button>
          </form>
        </div>
      )}
    </Modal>
  )
}
