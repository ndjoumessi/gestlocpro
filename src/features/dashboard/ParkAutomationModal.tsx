import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Checkbox } from '@/components/primitives/Choice'
import { Combobox } from '@/components/primitives/Combobox'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { ApiError, api } from '@/api/client'

/** Rattache le bouton du pied au formulaire du corps — voir le `footer` plus bas. */
const ID_DU_FORMULAIRE = 'automatismes-du-parc'

/**
 * LES AUTOMATISMES DU PARC : CE QUI PART, OU S'ÉCRIT, SANS QU'ON CLIQUE.
 *
 * ═══ POURQUOI CETTE MODALE EXISTE — ET C'EST LE REGISTRE QUI L'A EXIGÉE ═══
 *
 * Ces sept réglages vivaient dans `ParkSettingsModal`, qui en portait onze.
 * Le registre de `scripts/modales/registre.mjs` avait écrit, au lot du canal de
 * relance, une phrase qui s'adressait au lot suivant :
 *
 *   « CETTE BOÎTE EST DÉSORMAIS LA PLUS LONGUE DU REGISTRE […] dix réglages
 *     dans une seule modale, dont cinq pour la seule relance. Un onglet ou une
 *     seconde boîte serait la réponse, et ce lot-ci n'est pas celui qui doit la
 *     faire — mais LE PROCHAIN RÉGLAGE QU'ON Y AJOUTE DEVRAIT PAYER CE
 *     DÉCOUPAGE PLUTÔT QU'UN PLAFOND DE PLUS. »
 *
 * L'appel automatique des loyers est ce prochain réglage. Il a fait passer la
 * boîte de 721 à 878 px de défilement à 360 px en français — la porte l'a
 * refusé sur ses douze états, et c'est ce refus qui est devenu ce fichier.
 *
 * ═══ LA FRONTIÈRE N'EST PAS LA LONGUEUR, C'EST LA NATURE ═══
 *
 * `ParkSettingsModal` garde ce qu'un parc EST : son nom, son pays, sa devise,
 * sa délégation. Quatre valeurs d'identité, qu'on corrige une fois.
 *
 * Ici vit ce que le parc FAIT tout seul : relancer un retard, appeler les
 * loyers du mois. Deux automatismes, qu'on règle en pensant à ses locataires et
 * non à son parc — et dont on vient éteindre l'un un jour où il gêne, sans
 * traverser quatre champs qui n'ont rien à voir.
 *
 * Couper par la longueur aurait donné une boîte « réglages (suite) ». Celle-ci
 * a un titre qu'on peut lire avant de l'ouvrir.
 *
 * ═══ MÊME ROUTE, MÊME RÔLE ═══
 *
 * `PATCH /api/parks/:id` reçoit les deux modales : c'est le même parc, et le
 * serveur n'écrit que les champs présents. Réservée au propriétaire, comme la
 * correction du parc — un appel de loyer crée de la dette, et une relance parle
 * au locataire.
 */
export function ParkAutomationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { notify } = useToast()
  const { adhesionActive, rafraichir, estDemo } = useSession()

  const parkId = adhesionActive?.parkId ?? null

  /**
   * CE QUE LE SERVEUR DIT AUJOURD'HUI, et les replis quand il ne dit rien.
   *
   * Même règle que dans la correction du parc : chaque repli reproduit l'ANCIEN
   * comportement, pour ne proposer aucun changement que personne n'a demandé.
   * `autoRentCall` est la seule exception, et c'est un refus assumé — voir sa
   * ligne.
   */
  const origine = useMemo(
    () => ({
      /* Un serveur antérieur au champ ne le rend pas : le supposer ÉTEINT
         proposerait de « rallumer » une relance qui n'a jamais cessé. */
      autoReminders: adhesionActive?.autoReminders ?? true,
      reminderMilestoneDays: adhesionActive?.reminderMilestoneDays ?? 7,
      /* `6` et `UTC` : le couple exact de l'ancien cron quotidien. */
      reminderHour: adhesionActive?.reminderHour ?? 6,
      reminderTimeZone: adhesionActive?.reminderTimeZone ?? 'UTC',
      /* `sms` : exactement ce que la route écrivait EN DUR avant que le canal
         soit réglable. `in_app` et `email` ne sont pas réglables mais le
         serveur peut les rendre : on retombe alors sur `sms`, le seul des deux
         membres réglables qui soit aussi l'ancien comportement. */
      reminderChannel:
        adhesionActive?.reminderChannel === 'whatsapp' ? ('whatsapp' as const) : ('sms' as const),
      /* `?? false` — LE SEUL REPLI DE CETTE LISTE QUI REFUSE AU LIEU
         D'HÉRITER. Ici l'ancien comportement EST l'absence : l'appel
         automatique naît éteint, parce qu'il crée de la dette. Un serveur
         antérieur au champ sert donc des parcs qui n'appellent rien, et
         « éteint » est vrai de chacun. Supposer `true` ferait croire un parc
         couvert alors que rien n'appelle. */
      autoRentCall: adhesionActive?.autoRentCall ?? false,
      rentCallDayOfMonth: adhesionActive?.rentCallDayOfMonth ?? 1,
    }),
    [
      adhesionActive?.autoReminders,
      adhesionActive?.reminderMilestoneDays,
      adhesionActive?.reminderHour,
      adhesionActive?.reminderTimeZone,
      adhesionActive?.reminderChannel,
      adhesionActive?.autoRentCall,
      adhesionActive?.rentCallDayOfMonth,
    ],
  )

  const [envoi, setEnvoi] = useState(false)
  const [relances, setRelances] = useState(origine.autoReminders)
  const [jalon, setJalon] = useState(String(origine.reminderMilestoneDays))
  const [heure, setHeure] = useState(String(origine.reminderHour))
  const [fuseau, setFuseau] = useState(origine.reminderTimeZone)
  const [canal, setCanal] = useState<'sms' | 'whatsapp'>(origine.reminderChannel)
  const [appelAuto, setAppelAuto] = useState(origine.autoRentCall)
  const [jourDAppel, setJourDAppel] = useState(String(origine.rentCallDayOfMonth))

  /**
   * L'HEURE DE RELANCE, RELUE DANS LE FUSEAU DU NAVIGATEUR.
   *
   * `null` quand les deux fuseaux donnent la même heure — il n'y a alors rien à
   * dire —, et `null` aussi si `Intl` refuse la valeur : un fuseau saisi à la
   * main, une heure hors de 0–23 le temps d'une frappe. Une aide qui explose
   * pendant qu'on tape serait pire que l'aide absente.
   */
  const heureLocale = useMemo(() => {
    const valeur = Number(heure)
    if (!Number.isInteger(valeur) || valeur < 0 || valeur > 23) return null
    try {
      const aujourdhui = new Date()
      /* On construit l'instant qui vaut `heure` DANS le fuseau du parc : on
         part d'une heure UTC, on lit ce qu'elle donne là-bas, et on corrige de
         l'écart. Deux lectures suffisent — aucun décalage n'est fractionnaire
         au point de demander mieux. */
      const sonde = Date.UTC(
        aujourdhui.getUTCFullYear(),
        aujourdhui.getUTCMonth(),
        aujourdhui.getUTCDate(),
        valeur,
      )
      const lecture = (zone: string, instant: number) =>
        Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            hour: '2-digit',
            hour12: false,
          }).format(new Date(instant)),
        )
      const ecart = lecture(fuseau, sonde) - valeur
      const instant = sonde - ecart * 3_600_000
      const ici = lecture(Intl.DateTimeFormat().resolvedOptions().timeZone, instant)
      return ici === valeur ? null : `${String(ici).padStart(2, '0')}:00`
    } catch {
      return null
    }
  }, [heure, fuseau])

  /**
   * LES FUSEAUX VIENNENT D'`Intl`, jamais d'une liste écrite ici.
   *
   * Une liste recopiée vieillit — les fuseaux naissent et meurent par décision
   * politique — et elle divergerait de l'autorité que le serveur interroge pour
   * accepter la valeur. `UTC` est ajouté en tête parce que tous les moteurs ne
   * le rendent pas, et que c'est le défaut de tout parc existant : il doit
   * pouvoir se relire.
   */
  const optionsDeFuseau = useMemo(
    () => ['UTC', ...Intl.supportedValuesOf('timeZone')].map((z) => ({ value: z, label: z })),
    [],
  )

  /** Ce qui a changé, et rien d'autre. Vide quand la saisie est celle d'origine. */
  const correction: {
    autoReminders?: boolean
    reminderMilestoneDays?: number
    reminderHour?: number
    reminderTimeZone?: string
    reminderChannel?: 'sms' | 'whatsapp'
    autoRentCall?: boolean
    rentCallDayOfMonth?: number
  } = {}
  if (relances !== origine.autoReminders) correction.autoReminders = relances
  /* Le jalon ne part QUE s'il est un nombre dans les bornes : un champ vidé en
     cours de frappe ne doit pas écrire zéro. */
  const jalonLu = Number(jalon)
  if (
    Number.isInteger(jalonLu) &&
    jalonLu >= 1 &&
    jalonLu <= 90 &&
    jalonLu !== origine.reminderMilestoneDays
  ) {
    correction.reminderMilestoneDays = jalonLu
  }
  /* MÊME PRUDENCE POUR L'HEURE, avec une borne qui commence à ZÉRO : minuit est
     une heure d'envoi valide, et l'exclure priverait un parc d'un choix qu'il
     pourrait vouloir. Un champ vidé en cours de frappe ne part pas. */
  const heureLue = Number(heure)
  if (
    heure.trim() !== '' &&
    Number.isInteger(heureLue) &&
    heureLue >= 0 &&
    heureLue <= 23 &&
    heureLue !== origine.reminderHour
  ) {
    correction.reminderHour = heureLue
  }
  if (fuseau && fuseau !== origine.reminderTimeZone) correction.reminderTimeZone = fuseau
  if (canal !== origine.reminderChannel) correction.reminderChannel = canal
  if (appelAuto !== origine.autoRentCall) correction.autoRentCall = appelAuto
  /* MÊME PRUDENCE, avec une borne haute à 28 et non à 31 : c'est le plus grand
     jour que TOUT mois possède. Au-dessus, l'écran afficherait un jour qui
     n'est pas celui où l'appel part — le cron ramène au dernier jour du mois —
     et il le ferait cinq mois sur douze, ce qui est la pire fréquence pour un
     défaut. */
  const jourLu = Number(jourDAppel)
  if (
    jourDAppel.trim() !== '' &&
    Number.isInteger(jourLu) &&
    jourLu >= 1 &&
    jourLu <= 28 &&
    jourLu !== origine.rentCallDayOfMonth
  ) {
    correction.rentCallDayOfMonth = jourLu
  }

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    /* SANS PARC, ON LE DIT — même raison que dans la correction du parc : un
       `return` muet enfonce le bouton et ne fait rien, et c'est devenu visible
       le jour où la démonstration a pu ouvrir ces boîtes. */
    if (!parkId) {
      notify(t(estDemo ? 'app.parkAutomation.demoNoSave' : 'common.actionFailed'), {
        tone: estDemo ? 'neutral' : 'danger',
      })
      return
    }

    if (Object.keys(correction).length === 0) {
      // Le serveur rend 422 sur un corps vide — « Rien à corriger ». L'écran
      // n'a pas à aller chercher ce refus pour l'apprendre.
      notify(t('app.parkAutomation.unchanged'), { tone: 'danger' })
      return
    }

    setEnvoi(true)
    void api
      .updatePark(parkId, correction)
      .then(async () => {
        /* La session porte ces sept réglages : sans ce rafraîchi, rouvrir la
           boîte reproposerait l'état d'avant la correction. */
        await rafraichir()
        notify(t('app.parkAutomation.saved'), { tone: 'ok' })
        onClose()
      })
      .catch((cause: unknown) => {
        const code = cause instanceof ApiError ? cause.code : ''
        notify(code === 'has_managers' ? t('common.actionFailed') : t('common.actionFailed'), {
          tone: 'danger',
        })
      })
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.parkAutomation.title')}
      description={t('app.parkAutomation.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={ID_DU_FORMULAIRE} loading={envoi}>
            {t('app.parkAutomation.submit')}
          </Button>
        </>
      }
    >
      <form
        id={ID_DU_FORMULAIRE}
        onSubmit={enregistrer}
        noValidate
        className="flex flex-col gap-5"
      >
        {/*
          LES RELANCES AUTOMATIQUES, ET POURQUOI ELLES SE RÈGLENT DANS LE PRODUIT.

          Le CRON est bête : il passe toutes les heures. La POLITIQUE vit ici —
          faut-il relancer, au bout de combien de jours, à quelle heure et par
          quel canal. Laisser le jalon dans la planification obligerait un
          propriétaire à ouvrir un tableau de bord d'hébergeur pour changer
          d'avis sur ses propres locataires.

          L'INTERRUPTEUR VIENT EN PREMIER : cette relance n'avait jamais tourné,
          faute de lanceur. Elle part pour de bon, et le premier geste qu'on doit
          pouvoir faire est de l'ARRÊTER — avant d'avoir à comprendre le reste.
        */}
        {/* Une case ne passe PAS par `Field` : elle porte son propre libellé, et
            l'imbriquer donnerait deux étiquettes pour une commande. */}
        <Checkbox
          label={t('app.parkSettings.autoRemindersOn')}
          hint={t('app.parkSettings.autoRemindersHint')}
          checked={relances}
          onChange={(e) => setRelances(e.target.checked)}
        />

        {relances && (
          <Field
            label={t('app.parkSettings.reminderDay')}
            hint={t('app.parkSettings.reminderDayHint')}
          >
            {(props) => (
              <Input
                id={props.id}
                aria-describedby={props['aria-describedby']}
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={jalon}
                onChange={(e) => setJalon(e.target.value)}
              />
            )}
          </Field>
        )}

        {/*
          L'HEURE, ET SON FUSEAU — INSÉPARABLES.

          Le cron passe désormais toutes les heures et ne fait rien pour un parc
          dont ce n'est pas l'heure : la planification ne sait plus QUAND
          envoyer, seulement quand REGARDER. C'est ce qui permet à ce champ
          d'exister.

          « 7 h » ne veut rien dire sans le fuseau, et le PAYS ne le donne pas :
          ce produit a en production un parc qui porte `FR` et loue à Yaoundé.
          C'est l'heure de qui REÇOIT qui compte, jamais celle de qui administre.
        */}
        {relances && (
          <Field
            label={t('app.parkSettings.reminderHour')}
            /*
              L'HEURE QUE ÇA FAIT CHEZ CELUI QUI RÈGLE.

              Le couple par défaut est 6 h / UTC. Un propriétaire à Douala règle
              « 6 » en croyant six heures du matin chez lui, et la relance part
              à sept. L'aide disait « dans le fuseau choisi ci-dessous » : la
              règle, jamais sa conséquence — et c'est l'écran dont l'en-tête
              rappelle qu'« un parc porte FR et loue à Yaoundé ».

              `Intl` fait la conversion, sans rien demander à personne : on prend
              aujourd'hui à l'heure saisie DANS le fuseau choisi, et on la relit
              dans le fuseau du navigateur. Rien n'est ajouté quand les deux
              coïncident — redire « 6 h, soit 6 h » serait du bruit.
            */
            hint={
              heureLocale
                ? t('app.parkSettings.reminderHourHintLocal', { heure: heureLocale })
                : t('app.parkSettings.reminderHourHint')
            }
          >
            {(props) => (
              <Input
                id={props.id}
                aria-describedby={props['aria-describedby']}
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
              />
            )}
          </Field>
        )}

        {relances && (
          <Field
            label={t('app.parkSettings.reminderZone')}
            hint={t('app.parkSettings.reminderZoneHint')}
          >
            {(props) => (
              <Combobox
                id={props.id}
                aria-describedby={props['aria-describedby']}
                name="reminderTimeZone"
                placeholder={t('app.parkSettings.notSet')}
                autoComplete="off"
                options={optionsDeFuseau}
                value={fuseau}
                onChange={setFuseau}
              />
            )}
          </Field>
        )}

        {/**
         * PAR QUEL CANAL LA RELANCE PART — et ce que le produit ne peut pas
         * promettre.
         *
         * DEUX CHOIX SEULEMENT, sur les quatre que l'énumération porte.
         * `in_app` est ce que le produit ÉCRIT quand rien n'est parti : un
         * constat, pas une intention, et le proposer ici reviendrait à faire
         * choisir « ne rien envoyer » sous le nom d'un canal. `email` n'a pas
         * de rédaction de relance.
         *
         * L'AVERTISSEMENT N'EST PAS UNE PRÉCAUTION DE STYLE. Meta n'autorise un
         * message WhatsApp SORTANT hors d'une fenêtre de 24 h après le dernier
         * message du destinataire que s'il suit un MODÈLE qu'elle a approuvé ;
         * une relance de loyer est par nature non sollicitée. Sans ce modèle,
         * Twilio refuse, la couture rend `false`, et la relance reste dans le
         * produit — visible, mais pas partie.
         *
         * LE DIRE ICI, C'EST-À-DIRE AVANT. La découverte naturelle de cette
         * règle est un parc qui bascule sur WhatsApp et dont plus aucune
         * relance ne part, sans que rien à l'écran explique pourquoi. C'est
         * exactement la forme de panne que ce dépôt refuse ailleurs : un
         * réglage qui a l'air de marcher et n'envoie rien.
         */}
        {relances && (
          <Field
            label={t('app.parkSettings.reminderChannel')}
            hint={t('app.parkSettings.reminderChannelHint')}
          >
            {/* `Select` ET NON `Combobox` : deux options fixes, connues à
                l'avance et qui ne se cherchent pas. Le `Combobox` du dépôt sert
                les listes longues — pays, fuseaux — et pose son `name` sur un
                champ CACHÉ, ce qui rend le choix inatteignable à une garde de
                navigateur autrement qu'en déroulant un panneau. */}
            {(props) => (
              <Select
                {...props}
                name="reminderChannel"
                value={canal}
                onChange={(e) => setCanal(e.target.value as 'sms' | 'whatsapp')}
              >
                <option value="sms">{t('app.parkSettings.reminderChannelSms')}</option>
                <option value="whatsapp">
                  {t('app.parkSettings.reminderChannelWhatsApp')}
                </option>
              </Select>
            )}
          </Field>
        )}

        {relances && canal === 'whatsapp' && (
          <Notice tone="warn" icon="info">
            {t('app.parkSettings.reminderChannelWhatsAppWarning')}
          </Notice>
        )}

        {/**
         * L'APPEL AUTOMATIQUE DES ÉCHÉANCES — et pourquoi il naît éteint.
         *
         * ═══ CE QU'IL EST, ET CE QU'IL N'EST PAS ═══
         *
         * Une relance RAPPELLE une dette ; un appel la CRÉE. C'est la seule
         * commande de cette modale dont la mise en route fabrique de l'argent
         * dû, et c'est pourquoi elle est la seule à naître à `false` quand
         * toutes les autres héritent de l'ancien comportement.
         *
         * ═══ IL VIENT APRÈS LES RELANCES, ET L'ORDRE DIT LA DÉPENDANCE ═══
         *
         * Sans échéance, une relance n'a rien à réclamer : le cron des relances
         * rendait « 0 bail au jalon » sur les parcs dont personne n'avait
         * appelé le mois. Lire les deux réglages dans cet ordre, c'est lire la
         * chaîne dans le sens où elle coule.
         *
         * ═══ L'AIDE DIT LE GESTE, PAS LA RÈGLE ═══
         *
         * « Le jour du mois où l'appel part » n'apprend rien à qui hésite. Ce
         * qu'il faut savoir avant de cocher est que des échéances vont
         * apparaître sans qu'on clique, et que les rappeler ne double rien —
         * c'est cette seconde moitié qui autorise à essayer.
         */}
        <Checkbox
          label={t('app.parkSettings.autoRentCallOn')}
          hint={t('app.parkSettings.autoRentCallHint')}
          checked={appelAuto}
          onChange={(e) => setAppelAuto(e.target.checked)}
        />

        {appelAuto && (
          <Field
            label={t('app.parkSettings.rentCallDay')}
            hint={t('app.parkSettings.rentCallDayHint')}
          >
            {(props) => (
              <Input
                id={props.id}
                aria-describedby={props['aria-describedby']}
                type="number"
                inputMode="numeric"
                min={1}
                max={28}
                value={jourDAppel}
                onChange={(e) => setJourDAppel(e.target.value)}
              />
            )}
          </Field>
        )}
      </form>
    </Modal>
  )
}
