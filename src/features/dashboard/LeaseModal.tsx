import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { DatePicker } from '@/components/primitives/DatePicker'
import { Notice } from '@/components/primitives/Notice'
import { Icon } from '@/components/primitives/Icon'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { useSession } from '@/api/SessionProvider'
import { useToast } from '@/components/primitives/Toast'
import { api, ApiError } from '@/api/client'

const DONNEURS = ['tenant', 'landlord'] as const
type Donneur = (typeof DONNEURS)[number]

interface PanneauApi {
  lease: {
    id: string
    rentMinor: number
    status: 'pending' | 'active' | 'ended'
    noticeGivenOn: string | null
    noticeGivenBy: Donneur | null
    noticeReason: string | null
    moveOutOn: string | null
  }
  revisions: {
    id: string
    effectiveOn: string
    previousRentMinor: number
    newRentMinor: number
    reason: string | null
  }[]
  guarantors: {
    id: string
    fullName: string
    phoneE164: string | null
    email: string | null
    relation: string | null
  }[]
}

/**
 * LE BAIL ET SES SÛRETÉS — congé, révisions de loyer, garants.
 *
 * ═══ UNE SEULE BOÎTE POUR TROIS GESTES ═══
 *
 * Ils portent tous sur le MÊME bail et se consultent ensemble : on ne décide pas
 * d'une hausse sans savoir si un congé est arrivé, et on ne cherche un garant
 * qu'au moment où le loyer ne rentre plus. Trois boîtes auraient coûté trois fois
 * les registres de géométrie du dépôt pour trois formulaires de quatre champs, et
 * auraient obligé à refermer l'une pour lire l'autre.
 *
 * ═══ CE QUE CETTE BOÎTE NE FAIT PAS, ET LE DIT ═══
 *
 * Elle ne TERMINE pas un bail. Un congé annonce un départ ; le bail reste actif
 * jusqu'à la date d'effet, son loyer est encore appelé et ses charges encore
 * refacturées. Confondre les deux ferait cesser l'appel de loyer sur un logement
 * occupé — l'erreur inverse de celle que ce lot corrige, et la plus chère.
 *
 * Elle ne réécrit pas les quittances : `RentCharge` fige son loyer à l'appel, et
 * une révision au 1er avril laisse mars intact. C'est dit sous le champ de date,
 * avant le geste, plutôt que découvert après.
 */
/**
 * L'EN-TÊTE D'UNE SECTION, qui est aussi son interrupteur.
 *
 * `aria-expanded` ET `aria-controls` ne sont pas décoratifs : sans eux, un
 * lecteur d'écran annonce trois boutons dont rien ne dit qu'ils ouvrent quelque
 * chose, ni lequel est ouvert. Le titre reste un `h3` — il structure le document
 * même replié, et `lecture-sources` compte les niveaux de titre.
 */
function EnTeteDeSection({
  titre,
  ouverte,
  onBascule,
}: {
  titre: string
  ouverte: boolean
  onBascule: () => void
}) {
  return (
    <h3 className="title-m">
      <button
        type="button"
        onClick={onBascule}
        aria-expanded={ouverte}
        /* CIBLE À 44 px AU MOINS, comme toute commande du produit : un en-tête
           de 24 px de haut serait un piège au doigt. */
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        {titre}
        {/* `chevronDown` PIVOTÉ et non un second glyphe : le jeu d'icônes du dépôt
            n'a pas de `chevronUp`, et en ajouter un pour cet usage aurait
            alourdi le paquet de tous les écrans pour une rotation. */}
        <Icon
          name="chevronDown"
          className={`shrink-0 transition-transform ${ouverte ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
    </h3>
  )
}

export function LeaseModal({
  leaseId,
  unite,
  onClose,
}: {
  leaseId: string
  unite: string
  onClose: () => void
}) {
  const t = useT()
  const d = useDates()
  const { money, definition, parseAmount } = useCurrency()
  const { adhesionActive } = useSession()
  const { notify } = useToast()
  const parkId = adhesionActive?.parkId ?? null

  /**
   * LA SECTION OUVERTE, ET UNE SEULE À LA FOIS.
   *
   * Première rédaction : les trois sections déployées ensemble. Mesuré par
   * `modales` : 1196 px de défilement à 360 px, contre 0 à 347 pour toutes les
   * autres boîtes du produit. Le pied tenait et la boîte ne débordait pas — c'est
   * pourquoi rien d'autre ne le voyait — mais il fallait faire défiler tout le
   * congé pour atteindre les garants.
   *
   * Inscrire 1196 comme plafond aurait DÉSARMÉ la porte : elle existe pour
   * refuser exactement ce corps-là. Trois boîtes séparées auraient coûté trois
   * fois les registres du dépôt. Le dépliage est la troisième réponse, et la
   * seule qui garde le panneau d'un seul bail dans une seule boîte.
   *
   * LE CONGÉ EST OUVERT PAR DÉFAUT : c'est le geste qui a une échéance, et le
   * seul dont l'oubli se paie en loyer perdu.
   */
  const [section, setSection] = useState<'conge' | 'loyer' | 'garants'>('conge')
  const [panneau, setPanneau] = useState<PanneauApi | null>(null)
  const [donneur, setDonneur] = useState<Donneur>('tenant')
  const [recuLe, setRecuLe] = useState('')
  const [departLe, setDepartLe] = useState('')
  const [motifDuConge, setMotifDuConge] = useState('')
  const [nouveauLoyer, setNouveauLoyer] = useState('')
  const [aCompterDu, setACompterDu] = useState('')
  const [motifDeRevision, setMotifDeRevision] = useState('')
  const [nomDuGarant, setNomDuGarant] = useState('')
  const [telDuGarant, setTelDuGarant] = useState('')
  const [courrielDuGarant, setCourrielDuGarant] = useState('')
  const [lienDuGarant, setLienDuGarant] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  const [retraitDuConge, setRetraitDuConge] = useState(false)
  const [garantARetirer, setGarantARetirer] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const relire = useCallback(async () => {
    if (!parkId) return
    try {
      setPanneau(await api.leaseSureties<PanneauApi>(parkId, leaseId))
    } catch {
      /* UNE LECTURE QUI ÉCHOUE NE LAISSE PAS LE PANNEAU PRÉCÉDENT : un congé
         affiché après qu'il a été retiré ferait préparer une vacance qui n'a
         plus lieu. */
      setPanneau(null)
    }
  }, [parkId, leaseId])

  useEffect(() => {
    void relire()
  }, [relire])

  /** Traduit un refus du serveur en mots d'utilisateur, ou rend `null`. */
  function motifDuRefus(erreur: unknown): string | null {
    if (!(erreur instanceof ApiError)) return null
    if (erreur.code === 'lease_ended') return t('app.lease.leaseAlreadyEnded')
    if (erreur.code === 'same_rent') return t('app.lease.sameRent')
    if (erreur.code === 'revision_exists') return t('app.lease.revisionExists')
    return t('app.lease.failed')
  }

  async function agir(geste: () => Promise<unknown>, succes: string) {
    if (!parkId) {
      notify(t('app.lease.failed'), { tone: 'danger' })
      return
    }
    setEnCours(true)
    try {
      await geste()
      notify(succes)
      await relire()
    } catch (erreur) {
      const motif = motifDuRefus(erreur)
      if (motif === null) throw erreur
      notify(motif, { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  async function enregistrerLeConge() {
    const suivant: Record<string, string | undefined> = {}
    if (!recuLe) suivant.recuLe = t('app.lease.failed')
    if (!departLe) suivant.departLe = t('app.lease.failed')
    /* LA MÊME RÈGLE QUE LE SERVEUR, dite à l'écran plutôt que renvoyée par un
       400 : un départ antérieur au congé est un départ déjà consommé, qui se dit
       en terminant le bail et non en enregistrant un congé. */
    else if (recuLe && departLe < recuLe) suivant.departLe = t('app.lease.moveOutBeforeNotice')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['recuLe', 'departLe'] as const).find((c) => suivant[c])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[data-champ="${premier}"]`)?.focus()
      return
    }
    await agir(
      () =>
        api.giveNotice(parkId!, leaseId, {
          givenOn: recuLe,
          givenBy: donneur,
          moveOutOn: departLe,
          reason: motifDuConge.trim() || null,
        }),
      t('app.lease.noticeSaved'),
    )
  }

  async function reviser() {
    const minor = parseAmount(nouveauLoyer)
    const suivant: Record<string, string | undefined> = {}
    if (minor === null || minor <= 0) suivant.nouveauLoyer = t('app.lease.newRentRequired')
    if (!aCompterDu) suivant.aCompterDu = t('app.lease.newRentRequired')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['nouveauLoyer', 'aCompterDu'] as const).find((c) => suivant[c])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[data-champ="${premier}"]`)?.focus()
      return
    }
    await agir(
      () =>
        api.reviseRent(parkId!, leaseId, {
          effectiveOn: aCompterDu,
          newRentMinor: minor!,
          reason: motifDeRevision.trim() || null,
        }),
      t('app.lease.revisionSaved'),
    )
    setNouveauLoyer('')
  }

  async function ajouterUnGarant() {
    const suivant: Record<string, string | undefined> = {}
    if (!nomDuGarant.trim()) suivant.nomDuGarant = t('app.lease.guarantorNameRequired')
    /* AU MOINS UN MOYEN DE LE JOINDRE, et la même règle que le serveur : un
       garant sans téléphone ni courriel est un nom sur un papier, inutile le
       seul jour où on le lit. */
    else if (!telDuGarant.trim() && !courrielDuGarant.trim())
      suivant.telDuGarant = t('app.lease.guarantorContactRequired')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['nomDuGarant', 'telDuGarant'] as const).find((c) => suivant[c])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[data-champ="${premier}"]`)?.focus()
      return
    }
    await agir(
      () =>
        api.addGuarantor(parkId!, leaseId, {
          fullName: nomDuGarant.trim(),
          phoneE164: telDuGarant.trim() || null,
          email: courrielDuGarant.trim() || null,
          relation: lienDuGarant.trim() || null,
        }),
      t('app.lease.guarantorAdded'),
    )
    setNomDuGarant('')
    setTelDuGarant('')
    setCourrielDuGarant('')
    setLienDuGarant('')
  }

  const conge = panneau?.lease.noticeGivenOn ? panneau.lease : null

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('app.lease.openLine', { unit: unite })}
      description={t('app.lease.description')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <form
        id="bail"
        ref={formRef}
        onSubmit={(e) => e.preventDefault()}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* ── LE CONGÉ ── */}
        <section>
          <EnTeteDeSection
            titre={t('app.lease.noticeTitle')}
            ouverte={section === 'conge'}
            onBascule={() => setSection('conge')}
          />

          {section === 'conge' && (conge ? (
            <>
              <dl className="mt-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-muted">{t('app.lease.givenBy')}</dt>
                  <dd>{t(`app.lease.giver.${conge.noticeGivenBy!}` as 'app.lease.giver.tenant')}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-muted">{t('app.lease.givenOn')}</dt>
                  <dd>{d.fullDate(partiesDeDateISO(conge.noticeGivenOn!))}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-muted">{t('app.lease.moveOutOn')}</dt>
                  <dd>{d.fullDate(partiesDeDateISO(conge.moveOutOn!))}</dd>
                </div>
              </dl>
              {/* LE BAIL RESTE ACTIF, et c'est la note qui le dit — sans elle, un
                  congé enregistré se lirait comme une fin. Le titre nomme le FAIT
                  (« un départ est annoncé »), le corps dit sa CONSÉQUENCE. */}
              <Notice tone="warn" titre={t('app.lease.noticeTitle')} className="mt-3">
                {t('app.lease.moveOutHint')}
              </Notice>
              <div className="mt-3 flex items-center gap-2">
                {retraitDuConge ? (
                  <>
                    <span className="text-body-s">{t('app.lease.confirmWithdrawNotice')}</span>
                    <Button
                      variant="danger"
                      loading={enCours}
                      onClick={() =>
                        void agir(
                          () => api.withdrawNotice(parkId!, leaseId),
                          t('app.lease.noticeWithdrawn'),
                        ).then(() => setRetraitDuConge(false))
                      }
                    >
                      {t('app.lease.withdrawNotice')}
                    </Button>
                    <Button variant="secondary" onClick={() => setRetraitDuConge(false)}>
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setRetraitDuConge(true)}>
                    {t('app.lease.withdrawNotice')}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* AUCUN CONGÉ EST UN ÉTAT, pas une case vide : on le nomme. */}
              <Notice tone="ok" titre={t('app.lease.noticeNone')} className="mt-3">
                {t('app.lease.noticeNoneHint')}
              </Notice>
              <div className="mt-4 flex flex-col gap-4">
                <Field label={t('app.lease.givenBy')} required>
                  {(props) => (
                    <Combobox
                      id={props.id}
                      aria-describedby={props['aria-describedby']}
                      name="donneur"
                      autoComplete="off"
                      ouvrirAuFocus={false}
                      value={donneur}
                      onChange={(v) => setDonneur(v as Donneur)}
                      options={DONNEURS.map((g) => ({
                        value: g,
                        label: t(`app.lease.giver.${g}` as 'app.lease.giver.tenant'),
                      }))}
                    />
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('app.lease.givenOn')} required error={erreurs.recuLe}>
                    {(props) => (
                      <DatePicker
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        invalid={props['aria-invalid']}
                        name="recuLe"
                        value={recuLe}
                        onChange={setRecuLe}
                      />
                    )}
                  </Field>
                  <Field
                    label={t('app.lease.moveOutOn')}
                    hint={t('app.lease.moveOutHint')}
                    required
                    error={erreurs.departLe}
                  >
                    {(props) => (
                      <DatePicker
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        invalid={props['aria-invalid']}
                        name="departLe"
                        value={departLe}
                        onChange={setDepartLe}
                      />
                    )}
                  </Field>
                </div>
                <Field label={t('app.lease.noticeReason')} optional>
                  {(props) => (
                    <Input
                      {...props}
                      value={motifDuConge}
                      onChange={(e) => setMotifDuConge(e.target.value)}
                    />
                  )}
                </Field>
                <Button loading={enCours} onClick={() => void enregistrerLeConge()}>
                  {t('app.lease.giveNotice')}
                </Button>
              </div>
            </>
          ))}
        </section>

        {/* ── LE LOYER ── */}
        <section className="border-t border-divider pt-5">
          <EnTeteDeSection
            titre={t('app.lease.revisionTitle')}
            ouverte={section === 'loyer'}
            onBascule={() => setSection('loyer')}
          />
          {/* LE LOYER COURANT RESTE VISIBLE MÊME REPLIÉ : c'est la donnée, pas le
              geste, et on ne décide pas d'une hausse sans elle sous les yeux. */}
          <p className="text-body text-muted mt-1">
            {t('app.lease.currentRent')} · {money(panneau?.lease.rentMinor ?? 0)}
          </p>

          {section === 'loyer' && (<>
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('app.lease.newRent', { devise: definition.symbol })}
                error={erreurs.nouveauLoyer}
              >
                {(props) => (
                  <Input
                    {...props}
                    data-champ="nouveauLoyer"
                    inputMode="numeric"
                    value={nouveauLoyer}
                    onChange={(e) => setNouveauLoyer(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('app.lease.effectiveOn')}
                hint={t('app.lease.effectiveHint')}
                error={erreurs.aCompterDu}
              >
                {(props) => (
                  <DatePicker
                    id={props.id}
                    aria-describedby={props['aria-describedby']}
                    invalid={props['aria-invalid']}
                    name="aCompterDu"
                    value={aCompterDu}
                    onChange={setACompterDu}
                  />
                )}
              </Field>
            </div>
            <Field label={t('app.lease.revisionReason')} optional>
              {(props) => (
                <Input
                  {...props}
                  value={motifDeRevision}
                  onChange={(e) => setMotifDeRevision(e.target.value)}
                />
              )}
            </Field>
            <Button loading={enCours} onClick={() => void reviser()}>
              {t('app.lease.revise')}
            </Button>
          </div>

          {panneau && panneau.revisions.length === 0 ? (
            <p className="text-body text-muted mt-4">{t('app.lease.revisionsEmpty')}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-1">
              {panneau?.revisions.map((r) => (
                <li key={r.id} className="text-body-s">
                  {t('app.lease.revisionLine', {
                    avant: money(r.previousRentMinor),
                    apres: money(r.newRentMinor),
                    date: d.fullDate(partiesDeDateISO(r.effectiveOn)),
                  })}
                </li>
              ))}
            </ul>
          )}
          </>)}
        </section>

        {/* ── LES GARANTS ── */}
        <section className="border-t border-divider pt-5">
          <EnTeteDeSection
            titre={t('app.lease.guarantorsTitle')}
            ouverte={section === 'garants'}
            onBascule={() => setSection('garants')}
          />
          {/* LA CAUTION N'EST PAS UNE PERSONNE : le produit porte les deux, et
              les confondre coûte un recours le jour de l'impayé. */}
          <p className="text-body-s text-muted mt-1">{t('app.lease.guarantorsHint')}</p>

          {section === 'garants' && (<>
          {panneau && panneau.guarantors.length === 0 ? (
            <p className="text-body text-muted mt-3">{t('app.lease.guarantorsEmpty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {panneau?.guarantors.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate">{g.fullName}</span>
                    <span className="text-body-s text-muted">
                      {[g.relation, g.phoneE164, g.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {garantARetirer === g.id ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="danger"
                        loading={enCours}
                        onClick={() =>
                          void agir(
                            () => api.removeGuarantor(parkId!, g.id),
                            t('app.lease.guarantorRemoved'),
                          ).then(() => setGarantARetirer(null))
                        }
                      >
                        {t('app.expenses.remove')}
                      </Button>
                      <Button variant="secondary" onClick={() => setGarantARetirer(null)}>
                        {t('common.cancel')}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      aria-label={t('app.lease.removeGuarantorLine', { name: g.fullName })}
                      onClick={() => setGarantARetirer(g.id)}
                    >
                      {t('app.expenses.remove')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-4">
            <Field label={t('app.lease.guarantorName')} required error={erreurs.nomDuGarant}>
              {(props) => (
                <Input
                  {...props}
                  data-champ="nomDuGarant"
                  value={nomDuGarant}
                  onChange={(e) => setNomDuGarant(e.target.value)}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('app.lease.guarantorPhone')} optional error={erreurs.telDuGarant}>
                {(props) => (
                  <Input
                    {...props}
                    data-champ="telDuGarant"
                    inputMode="tel"
                    value={telDuGarant}
                    onChange={(e) => setTelDuGarant(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('app.lease.guarantorEmail')} optional>
                {(props) => (
                  <Input
                    {...props}
                    inputMode="email"
                    value={courrielDuGarant}
                    onChange={(e) => setCourrielDuGarant(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field
              label={t('app.lease.guarantorRelation')}
              hint={t('app.lease.guarantorRelationHint')}
              optional
            >
              {(props) => (
                <Input
                  {...props}
                  value={lienDuGarant}
                  onChange={(e) => setLienDuGarant(e.target.value)}
                />
              )}
            </Field>
            <Button loading={enCours} onClick={() => void ajouterUnGarant()}>
              {t('app.lease.addGuarantor')}
            </Button>
          </div>
          </>)}
        </section>
      </form>
    </Modal>
  )
}
