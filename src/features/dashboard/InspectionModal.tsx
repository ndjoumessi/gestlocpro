import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SegmentedControl } from '@/components/primitives/Choice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
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
  const { addInspection } = usePortfolio()

  const [nature, setNature] = useState<'entry' | 'exit'>('entry')
  const [date, setDate] = useState('')
  const [pieces, setPieces] = useState('3')
  const [signataire, setSignataire] = useState('')
  const [reserves, setReserves] = useState<Reserve[]>([RESERVE_VIDE])
  const [erreur, setErreur] = useState(false)

  function majReserve(index: number, champ: keyof Reserve, valeur: string) {
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
    const retenues = reserves
      .filter((r) => r.room.trim() && r.description.trim().length >= 3)
      .map((r) => ({
        room: r.room.trim(),
        description: r.description.trim(),
        severity: r.severity,
        ...(nature === 'exit' && Number(r.cout) > 0 ? { costMinor: Math.round(Number(r.cout)) } : {}),
      }))

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
                <Field label={t('app.inspections.cost')} className="min-w-24 flex-1">
                  {(champ) => (
                    <Input
                      {...champ}
                      inputMode="numeric"
                      value={reserve.cout}
                      onChange={(e) => majReserve(index, 'cout', e.target.value)}
                    />
                  )}
                </Field>
              )}
              <IconButton
                icon="close"
                label={t('app.inspections.removeFinding')}
                variant="ghost"
                onClick={() => setReserves((l) => (l.length === 1 ? [RESERVE_VIDE] : l.filter((_, i) => i !== index)))}
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
