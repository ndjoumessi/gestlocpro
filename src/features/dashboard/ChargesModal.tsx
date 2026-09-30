import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { useRole } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/Toast'
import { api, ApiError } from '@/api/client'
import { EnTeteDeSection } from './LeaseModal'

interface LigneApi {
  id: string
  label: string
  amountMinor: number
  kind: 'provision' | 'forfait'
}

interface DecompteApi {
  id: string
  periodStart: string
  periodEnd: string
  provisionedMinor: number
  actualMinor: number
  balanceMinor: number
  settledOn: string
  note: string | null
}

interface BrouillonApi {
  provisionedMinor: number
  unitExpensesMinor: number
  buildingExpensesMinor: number
}

/**
 * LES CHARGES CONVENUES AU BAIL, ET LE DÉCOMPTE QUI LES ARRÊTE.
 *
 * ═══ POURQUOI UNE BOÎTE À ELLE, ET PAS UNE SECTION DE PLUS DU BAIL ═══
 *
 * `LeaseModal` portait déjà quatre sections et 843 lignes — au-dessus du plafond
 * de maintenabilité du dépôt. Une cinquième l'aurait poussée vers 1 100, et son
 * défilement de 523 px vers 612. Le dépliage repousse le moment où une boîte
 * devient illisible ; il ne le supprime pas.
 *
 * ═══ CE QUE CET ÉCRAN REFUSE DE CALCULER ═══
 *
 * Les provisions APPELÉES sont exactes, et c'est le serveur qui les somme.
 *
 * Les dépenses réelles ne le sont pas. La plupart des charges récupérables sont
 * engagées au niveau de l'IMMEUBLE — une facture d'eau commune, un salaire de
 * gardien —, et le produit n'a aucune clé de répartition : ni tantièmes, ni
 * surfaces, ni nombre d'occupants. L'écran rend donc DEUX nombres séparés et
 * n'en propose aucune somme : additionner à la place du gestionnaire mettrait la
 * facture du bâtiment entier sur le dos d'un seul locataire, et personne ne
 * verrait passer l'erreur.
 */
export function ChargesModal({
  leaseId,
  unite,
  onClose,
}: {
  leaseId: string
  unite: string
  onClose: () => void
}) {
  const t = useT()
  const { money, parseAmount } = useCurrency()
  const { adhesionActive } = useSession()
  const { notify } = useToast()
  const parkId = adhesionActive?.parkId ?? null
  /* `useRole` ET NON `adhesionActive.role` : c'est le rôle ACTIF de la coquille,
     celui que l'écran des accès lit déjà pour décider ce qu'il propose. Passer
     par l'adhésion rendait la boîte entièrement vide en démonstration — qui n'a
     jamais d'adhésion — et sourde au sélecteur de rôle, qui est tout le propos
     de la démonstration. */
  const { role } = useRole()
  const estProprietaire = role === 'owner'

  const [section, setSection] = useState<'lignes' | 'decompte'>('lignes')
  const [lignes, setLignes] = useState<LigneApi[] | null>(null)
  const [decomptes, setDecomptes] = useState<DecompteApi[]>([])
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [nature, setNature] = useState<'provision' | 'forfait'>('provision')
  /* LE RETRAIT SE CONFIRME, comme celui d'un garant : une ligne effacée par
     mégarde cesse silencieusement d'être appelée, et personne ne s'en aperçoit
     avant la quittance suivante. */
  const [ligneARetirer, setLigneARetirer] = useState<string | null>(null)

  /* L'EXERCICE PAR DÉFAUT EST L'ANNÉE CIVILE ÉCOULÉE, parce qu'on régularise en
     début d'année ce qui vient de se clore. Modifiable : un bail signé en avril
     se régularise d'avril à mars, et le produit ne sait pas lequel des deux
     s'applique ici. */
  const anneeEcoulee = new Date().getUTCFullYear() - 1
  const [debut, setDebut] = useState(`${anneeEcoulee}-01-01`)
  const [fin, setFin] = useState(`${anneeEcoulee}-12-31`)
  const [arreteLe, setArreteLe] = useState('')
  const [reel, setReel] = useState('')
  const [noteDuDecompte, setNoteDuDecompte] = useState('')
  const [brouillon, setBrouillon] = useState<BrouillonApi | null>(null)
  const [enCours, setEnCours] = useState(false)

  const relire = useCallback(async () => {
    if (!parkId) {
      setLignes([])
      return
    }
    const lu = await api.leaseChargeLines<{ lines: LigneApi[]; settlements: DecompteApi[] }>(
      parkId,
      leaseId,
    )
    setLignes(lu.lines)
    setDecomptes(lu.settlements)
  }, [parkId, leaseId])

  useEffect(() => {
    void relire()
  }, [relire])

  /* LE BROUILLON SUIT LES BORNES, et se refait quand elles changent : un
     décompte affiché pour une période qu'on vient de modifier serait un chiffre
     juste sous une question devenue autre. */
  useEffect(() => {
    if (!parkId || !estProprietaire || !debut || !fin || fin < debut) {
      setBrouillon(null)
      return
    }
    let vivant = true
    void api
      .settlementDraft<{ draft: BrouillonApi }>(parkId, leaseId, debut, fin)
      .then((lu) => {
        if (vivant) setBrouillon(lu.draft)
      })
      .catch(() => {
        if (vivant) setBrouillon(null)
      })
    return () => {
      vivant = false
    }
  }, [parkId, leaseId, estProprietaire, debut, fin])

  async function poserLaLigne() {
    const minor = parseAmount(montant)
    if (!libelle.trim() || minor === null || minor <= 0) {
      notify(t('app.leaseCharges.lineIncomplete'), { tone: 'danger' })
      return
    }
    if (!parkId) {
      notify(t('app.leaseCharges.failed'), { tone: 'danger' })
      return
    }
    setEnCours(true)
    try {
      await api.addLeaseChargeLine(parkId, leaseId, {
        label: libelle.trim(),
        amountMinor: minor,
        kind: nature,
      })
      setLibelle('')
      setMontant('')
      await relire()
      notify(t('app.leaseCharges.lineAdded'))
    } catch (erreur) {
      notify(
        erreur instanceof ApiError && erreur.code === 'libelle_deja_pris'
          ? t('app.leaseCharges.lineDuplicate')
          : t('app.leaseCharges.failed'),
        { tone: 'danger' },
      )
    } finally {
      setEnCours(false)
    }
  }

  async function retirerLaLigne(id: string) {
    if (!parkId) return
    setEnCours(true)
    try {
      await api.removeLeaseChargeLine(parkId, id)
      await relire()
      notify(t('app.leaseCharges.lineRemoved'))
    } catch {
      notify(t('app.leaseCharges.failed'), { tone: 'danger' })
    } finally {
      setEnCours(false)
    }
  }

  async function arreter() {
    const minor = parseAmount(reel)
    if (!arreteLe || minor === null || minor < 0) {
      notify(t('app.leaseCharges.settlementIncomplete'), { tone: 'danger' })
      return
    }
    if (!parkId) {
      notify(t('app.leaseCharges.failed'), { tone: 'danger' })
      return
    }
    setEnCours(true)
    try {
      await api.settleCharges(parkId, leaseId, {
        periodStart: debut,
        periodEnd: fin,
        settledOn: arreteLe,
        actualMinor: minor,
        note: noteDuDecompte.trim() || null,
      })
      setReel('')
      setNoteDuDecompte('')
      await relire()
      notify(t('app.leaseCharges.settled'))
    } catch (erreur) {
      notify(
        erreur instanceof ApiError && erreur.code === 'exercice_deja_regularise'
          ? t('app.leaseCharges.settlementDuplicate')
          : t('app.leaseCharges.failed'),
        { tone: 'danger' },
      )
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('app.leaseCharges.title')}
      description={unite}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-4">
        <section>
          <EnTeteDeSection
            titre={t('app.leaseCharges.linesTitle')}
            ouverte={section === 'lignes'}
            onBascule={() => setSection(section === 'lignes' ? 'decompte' : 'lignes')}
          />
          {section === 'lignes' && (
            <div className="mt-2 space-y-3">
              {lignes !== null && lignes.length === 0 && (
                <p className="text-body text-muted">{t('app.leaseCharges.linesNone')}</p>
              )}
              {lignes !== null && lignes.length > 0 && (
                <ul className="space-y-2">
                  {lignes.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-2 border-s-2 border-subtle ps-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{l.label}</span>
                        {/* LA NATURE EST ÉCRITE, pas seulement teintée : c'est
                            elle qui décide si la somme revient au locataire au
                            décompte, et une couleur seule ne le dirait pas. */}
                        <span className="text-caption text-muted">
                          {t(
                            l.kind === 'provision'
                              ? 'app.leaseCharges.kindProvision'
                              : 'app.leaseCharges.kindForfait',
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span>{money(l.amountMinor)}</span>
                        {estProprietaire &&
                          (ligneARetirer === l.id ? (
                            <>
                              <Button
                                variant="danger"
                                size="sm"
                                loading={enCours}
                                onClick={() =>
                                  void retirerLaLigne(l.id).then(() => setLigneARetirer(null))
                                }
                              >
                                {t('app.expenses.remove')}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setLigneARetirer(null)}
                              >
                                {t('common.cancel')}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={t('app.leaseCharges.removeLine', { label: l.label })}
                              onClick={() => setLigneARetirer(l.id)}
                            >
                              {t('app.expenses.remove')}
                            </Button>
                          ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {estProprietaire && (
                /* UN FORMULAIRE, ET NON UNE PILE DE CHAMPS : dès qu'une boîte
                   en porte deux, la touche Entrée doit valider. Une modale qui
                   oblige à viser le bouton se remplit deux fois plus lentement,
                   et au clavier elle ne se remplit pas du tout. */
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void poserLaLigne()
                  }}
                >
                  <Field label={t('app.leaseCharges.lineLabel')}>
                    {(props) => (
                      <Input
                        {...props}
                        value={libelle}
                        onChange={(e) => setLibelle(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label={t('app.leaseCharges.lineAmount')}>
                    {(props) => (
                      <Input
                        {...props}
                        inputMode="numeric"
                        value={montant}
                        onChange={(e) => setMontant(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field
                    label={t('app.leaseCharges.lineKind')}
                    hint={t('app.leaseCharges.lineKindHint')}
                  >
                    {(props) => (
                      <Combobox
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        name="kind"
                        autoComplete="off"
                        ouvrirAuFocus={false}
                        value={nature}
                        onChange={(v) => setNature(v as 'provision' | 'forfait')}
                        options={[
                          { value: 'provision', label: t('app.leaseCharges.kindProvision') },
                          { value: 'forfait', label: t('app.leaseCharges.kindForfait') },
                        ]}
                      />
                    )}
                  </Field>
                  <Button type="submit" loading={enCours}>
                    {t('app.leaseCharges.addLine')}
                  </Button>
                </form>
              )}
            </div>
          )}
        </section>

        <section>
          <EnTeteDeSection
            titre={t('app.leaseCharges.settlementTitle')}
            ouverte={section === 'decompte'}
            onBascule={() => setSection(section === 'decompte' ? 'lignes' : 'decompte')}
          />
          {section === 'decompte' && (
            <div className="mt-2 space-y-3">
              {decomptes.map((d) => (
                <p key={d.id} className="text-body">
                  <span className="block">
                    {t('app.leaseCharges.settlementRange', {
                      from: d.periodStart,
                      to: d.periodEnd,
                    })}
                  </span>
                  <span className="text-caption text-muted">
                    {t(
                      d.balanceMinor >= 0
                        ? 'app.leaseCharges.balanceToRefund'
                        : 'app.leaseCharges.balanceToCollect',
                      { amount: money(Math.abs(d.balanceMinor)) },
                    )}
                  </span>
                </p>
              ))}

              {estProprietaire && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void arreter()
                  }}
                >
                  <Field label={t('app.leaseCharges.periodStart')}>
                    {(props) => (
                      <DatePicker
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        name="periodStart"
                        value={debut}
                        onChange={setDebut}
                      />
                    )}
                  </Field>
                  <Field label={t('app.leaseCharges.periodEnd')}>
                    {(props) => (
                      <DatePicker
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        name="periodEnd"
                        value={fin}
                        onChange={setFin}
                      />
                    )}
                  </Field>

                  {brouillon && (
                    <dl className="space-y-1 text-caption">
                      <div className="flex justify-between gap-2">
                        <dt>{t('app.leaseCharges.draftProvisioned')}</dt>
                        <dd>{money(brouillon.provisionedMinor)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t('app.leaseCharges.draftUnitExpenses')}</dt>
                        <dd>{money(brouillon.unitExpensesMinor)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t('app.leaseCharges.draftBuildingExpenses')}</dt>
                        <dd>{money(brouillon.buildingExpensesMinor)}</dd>
                      </div>
                      {/* LES DEUX DÉPENSES NE SONT PAS ADDITIONNÉES, ET LA
                          PHRASE LE DIT. Une somme affichée ici serait prise pour
                          le montant à retenir, alors que la part imputable à ce
                          bail dépend d'une clé que le produit n'a pas. */}
                      <p className="pt-1 text-muted">{t('app.leaseCharges.draftNoKey')}</p>
                    </dl>
                  )}

                  <Field
                    label={t('app.leaseCharges.actualAmount')}
                    hint={t('app.leaseCharges.actualAmountHint')}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        inputMode="numeric"
                        value={reel}
                        onChange={(e) => setReel(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label={t('app.leaseCharges.settledOn')}>
                    {(props) => (
                      <DatePicker
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        name="settledOn"
                        value={arreteLe}
                        onChange={setArreteLe}
                      />
                    )}
                  </Field>
                  <Field label={t('app.leaseCharges.note')} optional>
                    {(props) => (
                      <Input
                        {...props}
                        value={noteDuDecompte}
                        onChange={(e) => setNoteDuDecompte(e.target.value)}
                      />
                    )}
                  </Field>
                  <Button type="submit" loading={enCours}>
                    {t('app.leaseCharges.settle')}
                  </Button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
