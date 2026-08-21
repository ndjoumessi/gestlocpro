import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SegmentedControl } from '@/components/primitives/Choice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * Établissement d'un état des lieux.
 *
 * Seconde promesse de la grille tarifaire restée sans code — « entrée et sortie
 * comparées pièce par pièce, réserves relevées et horodatées, imputation
 * chiffrée sur la caution ». L'écran correspondant n'avait aucune commande,
 * et c'était juste : rien ne se cachait derrière.
 *
 * LE MONTANT N'APPARAÎT QUE SUR UNE SORTIE. Le serveur refuse en 422 une réserve
 * d'entrée chiffrée, et cette modale ne l'offre pas : le document d'entrée
 * relève ce qui est DÉJÀ abîmé, précisément pour que le locataire n'en réponde
 * pas. Proposer le champ puis se faire refuser aurait appris la règle par
 * l'échec.
 */

interface Reserve {
  room: string
  description: string
  severity: 'minor' | 'major'
  cout: string
}

/**
 * Ce qui PART au serveur pour une réserve.
 *
 * Le type se déduisait d'une chaîne `.filter().map()`. La lecture du coût
 * devant désormais pouvoir REFUSER — donc interrompre —, l'assemblage se fait
 * ligne à ligne, et un tableau qu'on remplit doit dire ce qu'il contient.
 * `costMinor` reste facultatif : toute réserve n'est pas chiffrée, et le
 * serveur refuse en 422 une réserve d'entrée qui le porterait.
 */
interface Retenue {
  room: string
  description: string
  severity: 'minor' | 'major'
  costMinor?: number
}

const RESERVE_VIDE: Reserve = { room: '', description: '', severity: 'minor', cout: '' }

export function InspectionModal({
  open,
  onClose,
  unitId,
}: {
  open: boolean
  onClose: () => void
  unitId: string
}) {
  const t = useT()
  const { notify } = useToast()
  const { parseAmount } = useCurrency()
  const { addInspection } = usePortfolio()

  const [nature, setNature] = useState<'entry' | 'exit'>('entry')
  const [date, setDate] = useState('')
  const [pieces, setPieces] = useState('3')
  const [signataire, setSignataire] = useState('')
  const [reserves, setReserves] = useState<Reserve[]>([RESERVE_VIDE])
  const [erreur, setErreur] = useState(false)
  /**
   * LA LIGNE dont le coût ne se lit pas, et non un simple drapeau.
   *
   * Un booléen aurait allumé le message sous tous les champs de coût à la fois,
   * dont les autres se lisaient très bien : le propriétaire aurait cherché sa
   * faute là où elle n'était pas.
   */
  const [coutFautif, setCoutFautif] = useState<number | null>(null)

  function majReserve(index: number, champ: keyof Reserve, valeur: string) {
    // Toute retouche éteint le refus : un message qui survit à la correction
    // qu'il a provoquée dit faux.
    setCoutFautif(null)
    setReserves((liste) =>
      liste.map((r, i) => (i === index ? { ...r, [champ]: valeur } : r)),
    )
  }

  function envoyer() {
    const nombre = Number(pieces)
    if (!Number.isFinite(nombre) || nombre <= 0) {
      setErreur(true)
      return
    }
    /**
     * Les lignes VIDES sont écartées, pas refusées.
     *
     * La modale ouvre sur une ligne pour montrer ce qu'on attend ; un logement
     * sans réserve est le cas normal et ne doit pas obliger à effacer la ligne
     * d'exemple. Le serveur, lui, refuserait une description trop courte.
     */
    const retenues: Retenue[] = []
    for (let index = 0; index < reserves.length; index++) {
      const r = reserves[index]
      if (!r.room.trim() || r.description.trim().length < 3) continue

      /**
       * LE COÛT PASSE PAR `parseAmount`, comme le loyer et la caution.
       *
       * Il se lisait par `Number(r.cout)`. Le propriétaire qui recopie le
       * montant tel qu'il s'affiche colle « 35 000 » avec l'espace insécable
       * étroite que `formatMoney` pose entre les milliers, ou « 35,50 » en
       * euros : `Number` rend `NaN` des deux fois, `NaN > 0` est faux, et la
       * réserve partait SANS son montant pendant que le toast annonçait
       * « état des lieux enregistré ». La caution s'arbitrait ensuite sur un
       * chiffre qui n'avait jamais été relevé.
       *
       * Un coût VIDE reste licite et vaut zéro : toute réserve n'est pas
       * chiffrée, et le champ n'apparaît même pas sur une entrée. Seul
       * l'ILLISIBLE arrête — sans ce refus, corriger la lecture n'aurait fait
       * que déplacer le silence d'un cran.
       */
      const cout = nature === 'exit' && r.cout.trim() ? parseAmount(r.cout) : 0
      if (cout === null || cout < 0) {
        setCoutFautif(index)
        return
      }

      retenues.push({
        room: r.room.trim(),
        description: r.description.trim(),
        severity: r.severity,
        ...(cout > 0 ? { costMinor: Math.round(cout) } : {}),
      })
    }

    addInspection(unitId, {
      kind: nature,
      rooms: Math.round(nombre),
      ...(date ? { performedOn: date } : {}),
      ...(signataire.trim() ? { signedByName: signataire.trim() } : {}),
      findings: retenues,
    })
    onClose()
    setReserves([RESERVE_VIDE])
    setSignataire('')
    notify(t('app.inspections.recorded'), { tone: 'ok' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.inspections.record')}
      description={t('app.inspections.recordBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={envoyer}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          label={t('app.inspections.kind')}
          value={nature}
          onChange={setNature}
          options={[
            { value: 'entry', label: t('app.inspections.entry') },
            { value: 'exit', label: t('app.inspections.exit') },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('app.inspections.performedOn')} optional>
            {() => (
              <DatePicker
                aria-label={t('app.inspections.performedOn')}
                name="edl-date"
                value={date}
                onChange={setDate}
              />
            )}
          </Field>

          <Field
            label={t('app.inspections.roomCount')}
            required
            {...(erreur ? { error: t('app.inspections.roomsError') } : {})}
          >
            {(champ) => (
              <Input
                {...champ}
                inputMode="numeric"
                value={pieces}
                invalid={erreur}
                onChange={(e) => {
                  setPieces(e.target.value)
                  setErreur(false)
                }}
              />
            )}
          </Field>
        </div>

        <Field label={t('app.inspections.signedBy')} optional hint={t('app.inspections.signedHint')}>
          {(champ) => (
            <Input
              {...champ}
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
            />
          )}
        </Field>

        <fieldset className="flex flex-col gap-3 border-0">
          <legend className="text-label font-semibold text-ink">
            {t('app.inspections.findings')}
          </legend>
          {reserves.map((reserve, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <Field label={t('app.inspections.room')} className="min-w-28 flex-1">
                {(champ) => (
                  <Input
                    {...champ}
                    value={reserve.room}
                    onChange={(e) => majReserve(index, 'room', e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('app.inspections.finding')} className="min-w-40 flex-[2]">
                {(champ) => (
                  <Input
                    {...champ}
                    value={reserve.description}
                    onChange={(e) => majReserve(index, 'description', e.target.value)}
                  />
                )}
              </Field>
              {/* Le montant, sur une SORTIE seulement. */}
              {nature === 'exit' && (
                <Field
                  label={t('app.inspections.cost')}
                  className="min-w-24 flex-1"
                  {...(coutFautif === index ? { error: t('common.amountUnreadable') } : {})}
                >
                  {(champ) => (
                    <Input
                      {...champ}
                      inputMode="numeric"
                      value={reserve.cout}
                      invalid={coutFautif === index}
                      onChange={(e) => majReserve(index, 'cout', e.target.value)}
                    />
                  )}
                </Field>
              )}
              <IconButton
                icon="close"
                label={t('app.inspections.removeFinding')}
                variant="ghost"
                onClick={() => {
                  // Retirer une ligne renumérote celles qui suivent : garder le
                  // repère du refus l'aurait fait désigner une voisine innocente.
                  setCoutFautif(null)
                  setReserves((l) => (l.length === 1 ? [RESERVE_VIDE] : l.filter((_, i) => i !== index)))
                }}
              />
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => setReserves((l) => [...l, RESERVE_VIDE])}
          >
            {t('app.inspections.addFinding')}
          </Button>
        </fieldset>
      </div>
    </Modal>
  )
}
