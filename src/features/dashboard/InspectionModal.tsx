import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button, IconButton } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Icon } from '@/components/primitives/Icon'
import { Input, Select } from '@/components/primitives/Input'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SegmentedControl } from '@/components/primitives/Choice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { usePortfolio, type ReserveCreee } from '@/data/PortfolioProvider'
import { PhotosDeReserve, type PhotoLocale } from './PhotosDeReserve'
import { PHOTOS_PAR_RESERVE, transcoderPhoto } from '@/lib/transcoderPhoto'

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
  photos: PhotoLocale[]
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

/**
 * UNE FABRIQUE, ET NON UNE CONSTANTE PARTAGÉE.
 *
 * C'était `const RESERVE_VIDE: Reserve = {...}`, réemployé pour l'état initial
 * ET pour « Ajouter une réserve ». Tant qu'une ligne ne portait que des
 * chaînes, le partage était sans effet : `majReserve` recopie l'objet à chaque
 * frappe. Une ligne porte maintenant un TABLEAU de photos — deux lignes nées du
 * même objet partageraient la même référence, et une photo ajoutée à la
 * troisième réserve apparaîtrait aussi sur la première.
 */
const reserveVide = (): Reserve => ({
  room: '',
  description: '',
  severity: 'minor',
  cout: '',
  photos: [],
})

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
  const { addInspection, envoyerPhotos } = usePortfolio()

  const [unite, setUnite] = useState(unitIds[0]?.id ?? '')
  const [nature, setNature] = useState<'entry' | 'exit'>('entry')
  const [date, setDate] = useState('')
  const [pieces, setPieces] = useState('3')
  const [signataire, setSignataire] = useState('')
  const [reserves, setReserves] = useState<Reserve[]>([reserveVide()])
  const [erreur, setErreur] = useState(false)
  /**
   * Distingue « en train d'envoyer » de « prêt à envoyer » : le bouton
   * reste actionnable pendant l'attente serveur si on ne le désactive pas,
   * et un double clic ouvrait alors deux états des lieux pour un seul geste.
   */
  const [envoi, setEnvoi] = useState(false)
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

  /**
   * LES URL D'OBJET SE LIBÈRENT, et il faut un registre pour cela.
   *
   * Chaque aperçu tient une URL bâtie sur le blob transcodé ; tant qu'elle
   * n'est pas révoquée, le navigateur garde le blob vivant. Compter sur le
   * ramasse-miettes ne marche pas : c'est l'URL qui retient, pas l'inverse.
   *
   * Le registre est un `ref` et non un état : il ne doit rien redessiner, et
   * surtout il doit survivre au démontage sans dépendre de ce que la fermeture
   * a laissé dans `reserves`.
   */
  const urlsVivantes = useRef(new Set<string>())
  useEffect(() => {
    const registre = urlsVivantes.current
    return () => {
      for (const url of registre) URL.revokeObjectURL(url)
      registre.clear()
    }
  }, [])

  /** Refus de transcodage, PAR LIGNE : il s'affiche sous la ligne fautive. */
  const [refusPhoto, setRefusPhoto] = useState<Record<number, string | null>>({})
  /** Ce qu'il reste à reprendre après un enregistrement partiellement échoué. */
  const [reprise, setReprise] = useState<{
    envois: { findingId: string; photo: PhotoLocale }[]
    message: string
  } | null>(null)

  async function choisirPhotos(index: number, fichiers: File[]) {
    setRefusPhoto((r) => ({ ...r, [index]: null }))
    const dejaLa = reserves[index]?.photos.length ?? 0
    // La borne est appliquée AVANT le transcodage : transcoder pour jeter
    // ensuite ferait chauffer le téléphone pour rien.
    const place = Math.max(0, PHOTOS_PAR_RESERVE - dejaLa)
    const retenus = fichiers.slice(0, place)

    const nouvelles: PhotoLocale[] = []
    let refus: string | null = null
    for (const fichier of retenus) {
      const resultat = await transcoderPhoto(fichier)
      if (!resultat.transcode) {
        refus =
          resultat.motif === 'heic'
            ? t('app.inspections.photoHeic')
            : t('app.inspections.photoUnreadable')
        continue
      }
      const apercu = URL.createObjectURL(resultat.octets)
      urlsVivantes.current.add(apercu)
      nouvelles.push({
        cle: `${Date.now()}-${nouvelles.length}-${Math.random().toString(36).slice(2, 8)}`,
        octets: resultat.octets,
        apercu,
        deposee: false,
        confirmee: false,
      })
    }

    if (nouvelles.length > 0) {
      setReserves((liste) =>
        liste.map((r, i) => (i === index ? { ...r, photos: [...r.photos, ...nouvelles] } : r)),
      )
    }
    if (refus) setRefusPhoto((r) => ({ ...r, [index]: refus }))
  }

  function retirerPhoto(index: number, cle: string) {
    setReserves((liste) =>
      liste.map((r, i) => {
        if (i !== index) return r
        const partante = r.photos.find((p) => p.cle === cle)
        if (partante) {
          URL.revokeObjectURL(partante.apercu)
          urlsVivantes.current.delete(partante.apercu)
        }
        return { ...r, photos: r.photos.filter((p) => p.cle !== cle) }
      }),
    )
    setRefusPhoto((r) => ({ ...r, [index]: null }))
  }

  /** Note l'avance d'une photo, pour qu'une reprise ne refasse pas le payé. */
  function avancerPhoto(cle: string, avance: Partial<PhotoLocale>) {
    setReserves((liste) =>
      liste.map((r) => ({
        ...r,
        photos: r.photos.map((p) => (p.cle === cle ? { ...p, ...avance } : p)),
      })),
    )
  }

  /**
   * APPARIE CHAQUE LIGNE À SA RÉSERVE CRÉÉE, et jamais par l'ordre du tableau.
   *
   * Le serveur rend les réserves sans garantie d'ordre. L'appariement se fait
   * donc sur les quatre champs qui les distinguent, `description` comprise —
   * c'est pour cela qu'elle a été ajoutée au `select`. Chaque réserve n'est
   * consommée qu'UNE fois : deux lignes rigoureusement identiques restent
   * possibles, et sans cette marque elles pointeraient vers la même.
   */
  function apparier(retenues: Retenue[], creees: ReserveCreee[]) {
    const libres = [...creees]
    return retenues.map((r) => {
      const i = libres.findIndex(
        (c) =>
          c.room === r.room &&
          c.description === r.description &&
          c.severity === r.severity &&
          (c.costMinor ?? 0) === (r.costMinor ?? 0),
      )
      if (i === -1) return null
      return libres.splice(i, 1)[0]
    })
  }

  async function envoyer() {
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
    // Les lignes VIDES sont écartées : le rang d'une retenue n'est donc pas
    // celui de sa ligne, et les photos, elles, sont attachées à la LIGNE.
    const ligneDeLaRetenue: number[] = []
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
      ligneDeLaRetenue.push(index)
    }

    // Même règle que l'ouverture d'un chantier (`OpenWorkModal`) : l'état des
    // lieux n'est annoncé enregistré qu'une fois le serveur d'accord, et la
    // saisie survit à un refus au lieu de disparaître avec la fermeture.
    setEnvoi(true)
    const creees = await addInspection(unite, {
      kind: nature,
      rooms: Math.round(nombre),
      ...(date ? { performedOn: date } : {}),
      ...(signataire.trim() ? { signedByName: signataire.trim() } : {}),
      findings: retenues,
    })
    if (creees === null) {
      setEnvoi(false)
      return
    }

    /**
     * LES PHOTOS PARTENT APRÈS, PARCE QU'ELLES NE PEUVENT PAS PARTIR AVANT.
     *
     * Une réserve n'a d'identifiant qu'une fois créée. Choisir la photo dans
     * la ligne et l'envoyer à l'enregistrement est la seule chaîne possible
     * sans inventer une réserve côté client.
     *
     * L'ÉTAT DES LIEUX, LUI, EST DÉJÀ ENREGISTRÉ à ce point. Un échec de photo
     * ne l'annule pas et ne doit pas le laisser croire : la modale reste
     * ouverte, garde les aperçus, et dit ce qui manque — fermer perdrait les
     * blobs, et une photo montée mais non confirmée est payée et invisible.
     */
    const apparies = apparier(retenues, creees)
    /**
     * UNE PHOTO QU'AUCUNE RÉSERVE N'ACCUEILLE EST UN ÉCHEC, pas un silence.
     *
     * L'appariement peut échouer — réponse sans réserves, champs qui ne
     * correspondent plus. Sans ce compte, ces photos seraient simplement
     * absentes des envois, la modale se fermerait sur « état des lieux
     * enregistré », et l'utilisateur repartirait convaincu d'avoir joint des
     * preuves qui ne sont nulle part. C'est le silence exact que ce document
     * existe pour empêcher.
     */
    let nonApparies = 0
    const envois = retenues.flatMap((_, rang) => {
      const ligne = reserves[ligneDeLaRetenue[rang]]
      if (!ligne) return []
      const aEnvoyer = ligne.photos.filter((photo) => !photo.confirmee)
      const creee = apparies[rang]
      if (!creee) {
        nonApparies += aEnvoyer.length
        return []
      }
      return aEnvoyer.map((photo) => ({ findingId: creee.id, photo }))
    })

    if (envois.length === 0 && nonApparies === 0) {
      setEnvoi(false)
      terminer()
      return
    }

    const resultat = await envoyerPhotos(envois, avancerPhoto)
    const echecs = resultat.echecs + nonApparies
    const { nonConfirmees } = resultat
    setEnvoi(false)

    if (echecs === 0 && nonConfirmees === 0) {
      terminer()
      return
    }

    // Les deux comptes ne se disent pas pareil : une photo non montée n'existe
    // nulle part, une photo montée sans confirmation est payée et perdue si on
    // ferme. Le second message l'emporte quand les deux sont là.
    setReprise({
      envois,
      message:
        nonConfirmees > 0
          ? t('app.inspections.photoConfirmFailed', { count: nonConfirmees })
          : t('app.inspections.photoUploadFailed', { count: echecs }),
    })
  }

  /** La sortie normale : on ferme, on vide, on félicite. */
  function terminer() {
    onClose()
    for (const url of urlsVivantes.current) URL.revokeObjectURL(url)
    urlsVivantes.current.clear()
    setReserves([reserveVide()])
    setSignataire('')
    setReprise(null)
    setRefusPhoto({})
    notify(t('app.inspections.recorded'), { tone: 'ok' })
  }

  /** Reprend l'envoi, et LUI SEUL : l'état des lieux est déjà enregistré. */
  async function reprendre() {
    if (!reprise) return
    setEnvoi(true)
    const restants = reprise.envois.filter(({ photo }) => {
      const vivante = reserves
        .flatMap((r) => r.photos)
        .find((p) => p.cle === photo.cle)
      return vivante ? !vivante.confirmee : false
    })
    const aJour = restants.map(({ findingId, photo }) => ({
      findingId,
      photo: reserves.flatMap((r) => r.photos).find((p) => p.cle === photo.cle) ?? photo,
    }))
    const { echecs, nonConfirmees } = await envoyerPhotos(aJour, avancerPhoto)
    setEnvoi(false)
    if (echecs === 0 && nonConfirmees === 0) {
      terminer()
      return
    }
    setReprise({
      envois: aJour,
      message:
        nonConfirmees > 0
          ? t('app.inspections.photoConfirmFailed', { count: nonConfirmees })
          : t('app.inspections.photoUploadFailed', { count: echecs }),
    })
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
          {/*
            LA REPRISE REMPLACE L'ENREGISTREMENT, elle ne s'ajoute pas à lui.

            À ce point l'état des lieux EST enregistré ; laisser « Enregistrer »
            le proposerait une seconde fois et en créerait un doublon. Seules
            les photos manquent, et c'est la seule action qui reste.
          */}
          {reprise ? (
            <Button loading={envoi} onClick={() => void reprendre()}>
              {t('app.inspections.photoRetry')}
            </Button>
          ) : (
            <Button type="submit" form="etat-des-lieux" loading={envoi}>{t('common.save')}</Button>
          )}
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
          void envoyer()
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
            { value: 'entry', label: t('app.inspections.kinds.entry') },
            { value: 'exit', label: t('app.inspections.kinds.exit') },
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

        {/*
          LE MESSAGE DE REPRISE VIT DANS LE CORPS, pas dans un toast.

          Il dit qu'un objet est payé et qu'il sera perdu à la fermeture : cette
          phrase-là doit rester lisible le temps qu'il faut pour agir. Un toast
          l'effacerait pendant que la donnée disparaît, ce que le dépôt refuse.
        */}
        {reprise && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-start gap-1.5 rounded-md border border-border bg-surface-sunken p-3 text-body text-danger"
          >
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>{reprise.message}</span>
          </p>
        )}

        <fieldset className="flex flex-col gap-3 border-0">
          <legend className="text-label font-semibold text-ink">
            {t('app.inspections.findings')}
          </legend>
          {/*
            UNE LISTE ORDONNÉE, UN BLOC PAR RÉSERVE.

            C'était une rangée qui se replie, sans bord : trois réserves saisies,
            et rien ne disait où l'une finissait — sinon l'ordre des champs, qui
            change de forme avec la largeur puisque la rangée se replie. La
            croix de retrait flottait entre la gravité et les photos, à une
            place qui n'appartenait visiblement à aucune des deux.

            LE RANG EXISTAIT POUR L'OREILLE ET PAS POUR L'ŒIL. « Retirer la
            réserve n° 2 » est le nom accessible de la croix, et le commentaire
            plus bas dit pourquoi il le faut. L'œil, lui, n'avait d'équivalent
            nulle part — le seul rang visible était celui qu'affichait, par
            accident, le bouton d'ajout de photo.

            `<ol>` et non des `<div>` : le rang, le groupement et le compte sont
            alors portés par la structure. Un lecteur d'écran annonce « liste,
            3 éléments » là où il ne trouvait que des champs à la file.
          */}
          <ol className="flex flex-col gap-3">
          {reserves.map((reserve, index) => (
            <li
              key={index}
              className="flex flex-wrap items-end gap-x-2 gap-y-1.5 border-l-2 border-border-strong pl-3"
            >
              {/* L'en-tête du bloc : le rang à gauche, le retrait à droite. Sur
                  sa propre ligne — `basis-full` — pour que le repliement des
                  champs ne vienne jamais s'intercaler entre un numéro et ce
                  qu'il numérote. */}
              <div className="-mx-1 flex basis-full items-center justify-between gap-2">
                <span className="eyebrow text-muted">
                  {t('app.inspections.findingRank', { rank: index + 1 })}
                </span>
                <IconButton
                  icon="close"
                  label={t('app.inspections.removeFinding', { rank: index + 1 })}
                  variant="ghost"
                  onClick={() => {
                    // Retirer une ligne renumérote celles qui suivent : garder
                    // le repère du refus l'aurait fait désigner une voisine
                    // innocente.
                    setCoutFautif(null)
                    setLacune(null)
                    // Les aperçus de la ligne qui part sont libérés ici : sans
                    // cela, leurs blobs resteraient vivants jusqu'à la fermeture
                    // de la modale, invisibles et payés en mémoire.
                    for (const photo of reserve.photos) {
                      URL.revokeObjectURL(photo.apercu)
                      urlsVivantes.current.delete(photo.apercu)
                    }
                    setReserves((l) => l.filter((_, i) => i !== index))
                  }}
                />
              </div>
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
                LE RETRAIT EST REMONTÉ DANS L'EN-TÊTE DU BLOC, et son libellé ne
                change pas.

                Deux défauts avaient été réglés sous ce contrôle et le restent.
                Il portait « Retirer cette réserve » sur chaque ligne : à la
                lecture d'écran, trois boutons d'un même nom dans un même
                formulaire, sans rien pour les distinguer. Le rang les sépare, et
                il se voit désormais aussi. Et sur la DERNIÈRE ligne il ne
                retirait rien : il la vidait, sous un libellé qui promettait un
                retrait. La ligne s'en va pour de bon ; « Ajouter une réserve »
                la rappelle, et l'ouverture suivante en repose une.

                Ce qui change ici est sa PLACE : il flottait entre la gravité et
                les photos, sur une rangée qui se replie — donc à un endroit qui
                n'appartenait visiblement à aucune des deux, et qui se déplaçait
                avec la largeur.
              */}
              <PhotosDeReserve
                rang={index + 1}
                photos={reserve.photos}
                refus={refusPhoto[index] ?? null}
                onChoisir={(fichiers) => void choisirPhotos(index, fichiers)}
                onRetirer={(cle) => retirerPhoto(index, cle)}
              />
            </li>
          ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => setReserves((l) => [...l, reserveVide()])}
          >
            {t('app.inspections.addFinding')}
          </Button>
        </fieldset>
      </form>
    </Modal>
  )
}
