import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
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
  unitIds,
}: {
  open: boolean
  onClose: () => void
  /**
   * LE PARC, et non un logement reçu tout fait.
   *
   * L'écran passait `logements[0].id` — le premier du parc, en dur — sous un
   * commentaire qui promettait de le demander « le jour où le parc en porte
   * plusieurs ». Il en portait douze depuis l'origine : onze logements étaient
   * hors d'atteinte, et le constat établi pour l'un d'eux s'enregistrait au nom
   * d'un autre sans que rien ne le dise. Le serveur ne pouvait pas rattraper la
   * confusion — l'unité qu'on lui donnait appartenait bien au parc.
   *
   * `OpenWorkModal` demande déjà le sien, et pour la même raison : le bailleur
   * choisit dans son parc, quand le locataire n'a qu'un logement.
   */
  unitIds: { id: string; label: string }[]
}) {
  const t = useT()
  const { notify } = useToast()
  const { parseAmount } = useCurrency()
  const { addInspection } = usePortfolio()

  const [unite, setUnite] = useState(unitIds[0]?.id ?? '')
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
  /**
   * LA LIGNE commencée et laissée en plan, avec le champ qui lui manque.
   *
   * Même précision que le refus ci-dessus, pour la même raison : le message se
   * pose sous le champ fautif, jamais sous les six autres qui vont bien.
   */
  const [lacune, setLacune] = useState<{ index: number; champ: 'room' | 'description' } | null>(
    null,
  )

  /** Ce champ-là, sur cette ligne-là, est-il celui qui manque ? */
  const manque = (index: number, champ: 'room' | 'description') =>
    lacune?.index === index && lacune.champ === champ

  function majReserve(index: number, champ: keyof Reserve, valeur: string) {
    // Toute retouche éteint le refus : un message qui survit à la correction
    // qu'il a provoquée dit faux.
    setCoutFautif(null)
    setLacune(null)
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
     * VIDE on écarte, COMMENCÉE on refuse.
     *
     * La modale ouvre sur une ligne pour montrer ce qu'on attend ; un logement
     * sans réserve est le cas normal et ne doit pas obliger à effacer la ligne
     * d'exemple. Une ligne À MOITIÉ saisie, elle, partait au même panier : la
     * pièce relevée sans le constat, ou le constat sans la pièce, disparaissait
     * entre le clic et le toast « état des lieux enregistré ». Le propriétaire
     * repartait convaincu d'avoir relevé la rayure que le document ne portait
     * pas, et la retenue s'arbitrait ensuite sur ce qui restait — l'exact
     * silence que ce document existe pour empêcher.
     *
     * Refuser, ici, n'est pas une rigueur de plus : c'est la seule façon de
     * distinguer « je n'avais rien à signaler » de « je n'ai pas fini ».
     */
    const retenues: Retenue[] = []
    for (let index = 0; index < reserves.length; index++) {
      const r = reserves[index]
      const piece = r.room.trim()
      const constat = r.description.trim()

      // Une ligne est vide quand RIEN n'y a été saisi. La gravité n'entre pas
      // dans le compte : elle vaut « léger » d'office et n'est le fait de
      // personne, si bien que la tenir pour une saisie rendrait toute ligne
      // intouchée obligatoire.
      if (!piece && !constat && !r.cout.trim()) continue
      if (!piece) {
        setLacune({ index, champ: 'room' })
        return
      }
      // Trois caractères : la même borne que le serveur, pour que le refus
      // arrive avant l'aller-retour plutôt qu'en 422.
      if (constat.length < 3) {
        setLacune({ index, champ: 'description' })
        return
      }

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
        room: piece,
        description: constat,
        severity: r.severity,
        ...(cout > 0 ? { costMinor: Math.round(cout) } : {}),
      })
    }

    addInspection(unite, {
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
          <Button type="submit" form="etat-des-lieux">{t('common.save')}</Button>
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
        id="etat-des-lieux"
        onSubmit={(e) => {
          e.preventDefault()
          envoyer()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        {/* Le logement d'abord : c'est lui qui décide de qui répondra des
            réserves relevées en dessous. */}
        <Field label={t('app.inspections.unit')} required>
          {(champ) => (
            <Select {...champ} value={unite} onChange={(e) => setUnite(e.target.value)}>
              {unitIds.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

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
              <Field
                label={t('app.inspections.room')}
                className="min-w-28 flex-1"
                {...(manque(index, 'room') ? { error: t('app.inspections.roomError') } : {})}
              >
                {(champ) => (
                  <Input
                    {...champ}
                    value={reserve.room}
                    invalid={manque(index, 'room')}
                    onChange={(e) => majReserve(index, 'room', e.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('app.inspections.finding')}
                className="min-w-40 flex-[2]"
                {...(manque(index, 'description')
                  ? { error: t('app.inspections.findingError') }
                  : {})}
              >
                {(champ) => (
                  <Input
                    {...champ}
                    value={reserve.description}
                    invalid={manque(index, 'description')}
                    onChange={(e) => majReserve(index, 'description', e.target.value)}
                  />
                )}
              </Field>
              {/*
                LA GRAVITÉ SE SAISIT.

                Elle partait au serveur depuis l'origine, toujours à « léger » :
                le type la déclarait, la route l'enregistrait, la colonne de
                comparaison l'écrivait en toutes lettres — « · dégradé » — et
                aucune main ne pouvait la poser. Une donnée qu'on affiche sans
                jamais pouvoir la produire est un champ mort, et celui-ci se lit
                comme un constat du bailleur : le locataire qui conteste une
                retenue voyait « léger » sous un mur défoncé.

                Elle n'ouvre pas la colonne du montant, qui reste l'affaire de la
                sortie : une réserve d'entrée se qualifie sans se chiffrer.
              */}
              <SegmentedControl
                label={t('app.inspections.severity')}
                value={reserve.severity}
                onChange={(gravite) => majReserve(index, 'severity', gravite)}
                options={[
                  { value: 'minor', label: t('app.inspections.severityMinor') },
                  { value: 'major', label: t('app.inspections.severityMajor') },
                ]}
              />
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
              {/*
                RETIRER RETIRE, et le bouton dit LAQUELLE.

                Deux défauts sous un seul contrôle. Il portait « Retirer cette
                réserve » sur chaque ligne : à la lecture d'écran, trois boutons
                d'un même nom dans un même formulaire, sans rien pour les
                distinguer — la liste des contrôles annonçait trois fois la même
                commande. Le rang les sépare, et c'est le seul repère qu'ait le
                lecteur puisque les champs, eux, sont vides.

                Et sur la DERNIÈRE ligne il ne retirait rien : il la vidait, sous
                un libellé qui promettait un retrait. Une pièce et un constat
                effacés d'un clic ressemblent à s'y méprendre à une ligne retirée,
                sauf qu'elle reste — et qu'un montant retapé à côté repart avec
                elle. La ligne s'en va pour de bon ; « Ajouter une réserve » la
                rappelle, et l'ouverture suivante en repose une.
              */}
              <IconButton
                icon="close"
                label={t('app.inspections.removeFinding', { rank: index + 1 })}
                variant="ghost"
                onClick={() => {
                  // Retirer une ligne renumérote celles qui suivent : garder le
                  // repère du refus l'aurait fait désigner une voisine innocente.
                  setCoutFautif(null)
                  setLacune(null)
                  setReserves((l) => l.filter((_, i) => i !== index))
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
      </form>
    </Modal>
  )
}
