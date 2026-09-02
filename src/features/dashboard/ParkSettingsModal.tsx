import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Checkbox } from '@/components/primitives/Choice'
import { Combobox } from '@/components/primitives/Combobox'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT, useI18n } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { countryOptions } from '@/lib/countries'
import { ApiError, api, DEVISES_DU_PARC, type DeviseDuParc } from '@/api/client'

/** Rattache le bouton du pied au formulaire du corps — voir le `footer` plus bas. */
const ID_DU_FORMULAIRE = 'correction-du-parc'

/**
 * CORRIGER LE PARC : SON NOM, SON PAYS, SA DEVISE, SA DÉLÉGATION.
 *
 * Les quatre sont posés à la création du parc et n'étaient modifiables nulle
 * part. Un propriétaire dont le parc était né dans la mauvaise devise l'était
 * pour toujours, et chaque loyer qu'il saisissait était relu dans une unité qui
 * n'est pas la sienne.
 *
 * Le cas n'est pas théorique : « Parc Bastos » — un quartier de Yaoundé — est né
 * `FR`/`EUR` en production, parce que le pays du compte se déduisait de la
 * devise affichée sur la vitrine en prenant le premier pays de la liste qui la
 * porte, et que la France y est en tête.
 *
 * Réservée au propriétaire : la devise n'est pas un réglage d'affichage, c'est
 * l'unité de tout ce qui se compte dans le parc. Même partage que la validation
 * d'un devis ou l'arbitrage d'une caution.
 *
 * LA DÉLÉGATION LES REJOINT, et c'est le sujet de ce lot.
 *
 * Elle s'écrivait depuis l'écran de prise en main, qui est un écran d'EXPLICATION
 * — il dessine la matrice des droits pour la faire comprendre. Deux endroits
 * réglaient donc le parc, avec deux contrôles d'apparence identique dont un seul
 * enregistrait : l'ambiguïté exacte que ce dépôt passe son temps à retirer.
 *
 * Le critère n'est pas le confort mais la nature de la valeur : le nom, le pays,
 * la devise et la délégation sont les quatre choses qu'un parc EST. Elles se
 * corrigent au même endroit, sous la même règle de rôle, avec le même
 * rafraîchissement de session derrière.
 */
export function ParkSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { locale } = useI18n()
  const { notify } = useToast()
  const { adhesionActive, rafraichir, estDemo } = useSession()
  const { currency } = useCurrency()

  const parkId = adhesionActive?.parkId ?? null
  /**
   * EN DÉMONSTRATION, LE FORMULAIRE S'OUVRE SUR CE QUE LA DÉMONSTRATION MONTRE.
   *
   * Sans cela il s'ouvrait vide — trois champs blancs et une modale qui ne
   * ressemble à rien de ce que le produit fait. Le nom est celui que la coquille
   * affiche déjà en tête de la barre latérale, la devise celle du sélecteur de
   * l'en-tête ; le pays reste vide, parce qu'aucun n'est choisi et qu'en inventer
   * un ferait dire à l'écran quelque chose que personne n'a décidé.
   *
   * `DEVISES_DU_PARC` FILTRE, ET LE CAS RÉEL EST « CFA ». Le sélecteur de
   * l'en-tête parle en devises d'AFFICHAGE, où les deux francs partagent un seul
   * code — même parité, même sigle à l'écran. Le parc, lui, doit trancher entre
   * `XAF` et `XOF`, parce que ce sont deux monnaies et deux zones. Mesuré : la
   * démonstration démarre sur `CFA`, qui n'est dans aucune des deux listes du
   * parc.
   *
   * Le repli est donc VIDE, et c'est le seul choix honnête : convertir « CFA »
   * en `XAF` reviendrait à désigner la CEMAC parce qu'elle vient en premier
   * dans la liste — le geste exact qui a fait naître « Parc Bastos » en `FR`/`EUR`
   * et que l'en-tête de ce fichier raconte.
   */
  const deviseDeDemo = (DEVISES_DU_PARC as readonly string[]).includes(currency)
    ? (currency as DeviseDuParc)
    : ''

  /**
   * Les valeurs d'origine, figées à l'ouverture.
   *
   * C'est à elles que la saisie est comparée pour savoir ce qui a changé : sans
   * cette référence, l'écran enverrait les trois champs à chaque fois et
   * réécrirait le pays et la devise avec ce qu'il croyait savoir en s'ouvrant.
   */
  const origine = useMemo(
    () => ({
      name: adhesionActive?.parkName ?? (estDemo ? t('common.demoPark') : ''),
      countryCode: adhesionActive?.countryCode ?? '',
      /* Un serveur antérieur au champ ne le rend pas : le supposer ÉTEINT
         proposerait de « rallumer » une relance qui n'a jamais cessé. */
      autoReminders: adhesionActive?.autoReminders ?? true,
      reminderMilestoneDays: adhesionActive?.reminderMilestoneDays ?? 7,
      currency: (adhesionActive?.currency ?? (estDemo ? deviseDeDemo : '')) as DeviseDuParc | '',
      /* `?? 'delegate'` : un serveur antérieur au champ ne le rend pas, et le
         supposer `solo` proposerait de « rétablir » une délégation que le parc
         n'a jamais perdue. C'est le défaut du schéma. */
      delegation: adhesionActive?.delegation ?? 'delegate',
    }),
    [
      adhesionActive?.parkName,
      adhesionActive?.countryCode,
      adhesionActive?.currency,
      adhesionActive?.delegation,
      // Les trois de la démonstration : sans elles, le repli se figerait sur la
      // langue et la devise du premier rendu, et changer l'une des deux dans
      // l'en-tête laisserait la modale sur l'ancienne.
      estDemo,
      deviseDeDemo,
      t,
    ],
  )

  const [nom, setNom] = useState(origine.name)
  const [pays, setPays] = useState(origine.countryCode)
  const [devise, setDevise] = useState<DeviseDuParc | ''>(origine.currency)
  const [delegation, setDelegation] = useState<'solo' | 'delegate'>(origine.delegation)
  const [envoi, setEnvoi] = useState(false)
  /**
   * LE CHAMP EFFACÉ N'ÉTAIT PAS UN CHAMP INCHANGÉ.
   *
   * `correction.name` ne se pose que si `nom.trim()` est vrai : la garde évite
   * d'envoyer un nom blanc, mais elle ne DIT rien de ce cas, et l'écran
   * traitait alors une case vidée comme une case intacte — jusqu'au même
   * « Rien n'a changé » qu'un formulaire jamais touché. Le champ porte
   * pourtant `required`, comme les autres modales de saisie du dossier.
   */
  const [erreurNom, setErreurNom] = useState<string | undefined>(undefined)
  const [relances, setRelances] = useState(origine.autoReminders)
  const [jalon, setJalon] = useState(String(origine.reminderMilestoneDays))

  const optionsDePays = useMemo(() => countryOptions(locale), [locale])

  const deviseChange = devise !== '' && devise !== origine.currency

  /** Ce qui a changé, et rien d'autre. Vide quand la saisie est celle d'origine. */
  const correction: {
    autoReminders?: boolean
    reminderMilestoneDays?: number
    name?: string
    countryCode?: string
    currency?: DeviseDuParc
    delegation?: 'solo' | 'delegate'
  } = {}
  if (nom.trim() && nom.trim() !== origine.name) correction.name = nom.trim()
  if (pays && pays !== origine.countryCode) correction.countryCode = pays
  if (deviseChange) correction.currency = devise as DeviseDuParc
  if (delegation !== origine.delegation) correction.delegation = delegation
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

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    /**
     * SANS PARC, ON LE DIT — on ne rendait rien.
     *
     * `if (!parkId) return` était muet : le bouton s'enfonçait, la modale
     * restait ouverte, et rien n'arrivait. C'est la forme exacte du contrôle
     * mort que ce dépôt retire partout ailleurs, et elle est devenue visible le
     * jour où la démonstration a pu ouvrir cette modale — avant, personne ne
     * pouvait l'atteindre pour s'en apercevoir.
     *
     * Le message NOMME ce que la démonstration ne fait pas, et où le geste
     * existe pour de vrai : la devise se change dans l'en-tête, sur-le-champ,
     * pour toute la démonstration.
     */
    if (!parkId) {
      notify(t(estDemo ? 'app.parkSettings.demoNoSave' : 'common.actionFailed'), {
        tone: estDemo ? 'neutral' : 'danger',
      })
      return
    }

    if (!nom.trim()) {
      // Le seul champ requis de cette modale : le dire ici plutôt que de
      // laisser « Rien n'a changé » répondre à la place d'un nom effacé.
      setErreurNom(t('app.parkSettings.nameRequired'))
      return
    }
    setErreurNom(undefined)

    if (Object.keys(correction).length === 0) {
      // Le serveur rend 422 sur un corps vide — « Rien à corriger ». L'écran
      // n'a pas à aller chercher ce refus pour l'apprendre.
      notify(t('app.parkSettings.unchanged'), { tone: 'danger' })
      return
    }

    setEnvoi(true)
    void api
      .updatePark(parkId, correction)
      .then(async () => {
        /**
         * La session porte le nom, le pays et la devise du parc, et le cadre
         * applique cette devise à tout ce qui s'affiche. Sans ce rafraîchi,
         * l'écran continuerait de compter dans l'unité corrigée d'il y a une
         * seconde — le défaut même que ce lot répare.
         */
        await rafraichir()
        notify(t('app.parkSettings.saved'), { tone: 'ok' })
        onClose()
      })
      .catch((cause: unknown) => {
        /**
         * `has_managers` a son propre message.
         *
         * Le serveur refuse la gestion seule tant qu'un gestionnaire opère le
         * parc. « L'action a échoué » laisserait chercher une panne là où il y a
         * une règle, et surtout ne nommerait pas le geste qui débloque — retirer
         * l'accès, au registre des accès.
         */
        const code = cause instanceof ApiError ? cause.code : ''
        notify(
          code === 'has_managers' ? t('app.parkSettings.hasManagers') : t('common.actionFailed'),
          { tone: 'danger' },
        )
      })
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.parkSettings.title')}
      description={t('app.parkSettings.description')}
      /*
        L'ACTION PASSE AU PIED, ET C'ÉTAIT LA SEULE MODALE À NE PAS LE FAIRE.

        Son bouton vivait DANS le corps, sous les quatre champs. Le corps défile
        quand la fenêtre est courte : l'action s'en allait avec lui, alors que le
        titre du fichier qui les mesure est « les modales tiennent dans la
        fenêtre, ET LEUR ACTION RESTE SOUS LES YEUX ». Mesuré à 360 px en
        français : 35 px de défilement, et le relevé disait « pied — » là où les
        dix autres disent « pied tenu ». Personne ne l'avait vu — la modale était
        inatteignable en démonstration, donc jamais mesurée.

        « Annuler » l'accompagne, pour la même raison de conformité : les autres
        modales de saisie du dossier en portent un, et une modale de correction
        est précisément celle qu'on ouvre pour renoncer.

        Le bouton est rattaché au `<form>` par `form={ID}` : `Modal` rend le
        corps et le pied dans deux `<div>` FRÈRES, donc un bouton du pied n'est
        pas descendant du formulaire et ne le soumettrait pas autrement.
      */
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={ID_DU_FORMULAIRE}
            loading={envoi}
            variant={deviseChange ? 'danger' : 'primary'}
          >
            {/* Le bouton NOMME le geste quand il devient irréversible : on ne
                clique pas par habitude sur « Enregistrer » quand ce qui part
                change l'unité de tous les montants du parc. */}
            {deviseChange ? t('app.parkSettings.confirmCurrency') : t('app.parkSettings.submit')}
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
        <Field label={t('app.parkSettings.name')} required error={erreurNom}>
          {(props) => (
            <Input
              {...props}
              name="name"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value)
                if (erreurNom) setErreurNom(undefined)
              }}
            />
          )}
        </Field>

        <Field label={t('app.parkSettings.country')} hint={t('app.parkSettings.countryHint')}>
          {(props) => (
            /*
              DEUX CENT QUARANTE-DEUX PAYS DANS UN `<select>` : LE PANNEAU DU
              SYSTÈME, PAR-DESSUS LA MODALE.

              Mesuré : il s'ouvrait du haut de la fenêtre jusqu'en bas et
              recouvrait le titre, la description, le nom du parc et les deux
              champs suivants. On choisissait son pays à l'aveugle, dans un
              formulaire dont on ne voyait plus rien — le défaut exact que le
              lot précédent a retiré du dernier calendrier natif du produit,
              sous un autre nom.

              Et il ne se cherchait pas : le saut à la frappe du natif est un
              préfixe strict, sans filtre ni retour visible, et la souris comme
              le tactile n'y ont pas droit. `SignUp` avait déjà tranché la même
              question, avec la même liste, en posant la règle : « le champ
              cherchable est déjà celui de l'indicatif, deux champs plus haut —
              la même notion mérite le même geste. » Cette modale avait été
              écrite après, et ne l'a pas suivi.

              L'OPTION VIDE DISPARAÎT SANS QUE SA RAISON D'ÊTRE S'EN AILLE. Elle
              existait parce qu'un `<select>` dont la valeur ne correspond à
              aucune option affiche LA PREMIÈRE : sans elle, la modale annonçait
              « Belgique » sur un parc dont personne n'avait posé le pays — le
              mensonge même que l'en-tête de ce fichier raconte. Un combobox n'a
              pas ce travers : sans choix, il affiche son texte d'invite, qui
              porte les mêmes mots. La contrainte tombe donc avec le contrôle
              qui la portait, et non par oubli.
            */
            <Combobox
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="countryCode"
              /* `country` : le champ ENVOIE le code ISO — celui que porte
                 l'entrée cachée du combobox et que le serveur attend. */
              autoComplete="country"
              placeholder={t('app.parkSettings.notSet')}
              options={optionsDePays.map(({ code, label, servi }) => ({
                value: code,
                label,
                groupe: t(servi ? 'common.countryGroupServed' : 'common.countryGroupOther'),
              }))}
              value={pays}
              onChange={setPays}
            />
          )}
        </Field>

        <Field label={t('app.parkSettings.currency')} hint={t('app.parkSettings.currencyHint')}>
          {(props) => (
            <Select
              {...props}
              name="currency"
              value={devise}
              onChange={(e) => setDevise(e.target.value as DeviseDuParc)}
            >
              {/* Même raison que pour le pays, quelques lignes plus haut. */}
              <option value="" disabled>
                {t('app.parkSettings.notSet')}
              </option>
              {/*
                DEUX ORIGINES POUR CINQ LIBELLÉS, et la frontière a un sens.

                `XAF` et `XOF` n'existent QUE pour le stockage : l'écran ne
                connaît qu'un franc, le parc doit en choisir un des deux. Leurs
                libellés qualifient la zone et ne servent qu'ici.

                Les trois autres sont les mêmes devises que le menu de
                l'en-tête et que l'inscription proposent — elles se nomment
                donc au même endroit qu'eux. Elles avaient ici leur propre jeu
                de clés, jumeau et indépendant : deux vocabulaires pour la même
                notion, dont l'un pouvait dériver sans que rien ne le dise.
              */}
              {DEVISES_DU_PARC.map((code) => (
                <option key={code} value={code}>
                  {code === 'XAF' || code === 'XOF'
                    ? t(`app.parkSettings.currency${code}` as 'app.parkSettings.currencyXAF')
                    : t(`common.currencyNames.${code}` as 'common.currencyNames.CFA')}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('app.parkSettings.delegation')}
          hint={t('app.parkSettings.delegationHint')}
        >
          {(props) => (
            <Select
              {...props}
              name="delegation"
              value={delegation}
              onChange={(e) => setDelegation(e.target.value as 'solo' | 'delegate')}
            >
              <option value="delegate">{t('app.onboarding.delegateOn')}</option>
              <option value="solo">{t('app.onboarding.delegateOff')}</option>
            </Select>
          )}
        </Field>

        {/*
          LES RELANCES AUTOMATIQUES, ET POURQUOI ELLES SE RÈGLENT ICI.

          Le CRON est bête : il passe tous les jours à heure fixe. La POLITIQUE
          vit dans le produit — faut-il relancer, et au bout de combien de jours.
          Laisser le jalon dans la planification obligerait un propriétaire à
          ouvrir un tableau de bord d'hébergeur pour changer d'avis sur ses
          propres locataires.

          L'INTERRUPTEUR VIENT EN PREMIER : cette relance n'avait jamais tourné,
          faute de lanceur. Elle se met à partir pour de bon, et le premier geste
          qu'on doit pouvoir faire est de l'ARRÊTER — avant d'avoir à comprendre
          le reste.
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

        {/**
         * L'AVERTISSEMENT, et il ne paraît que si la devise change.
         *
         * Les montants sont stockés en unités mineures, sans devise attachée :
         * un loyer de 180 000 relu en euros reste 180 000, soit six cent
         * cinquante-six fois sa valeur. Le geste n'est pas interdit — le cas qui
         * l'appelle est le parc jeune qu'on resaisit — mais il se dit avant le
         * clic, et non après.
         *
         * `icon="info"` : le ton `warn` porte l'alerte par défaut, et ce site-ci
         * disait `info`. Le glyphe est reporté tel quel ; seuls le rayon et le
         * rembourrage rejoignent ceux de la forme compacte, qui est la forme de
         * ce bandeau — une phrase sans titre — et cet écart-là est la dérive que
         * `Notice` existe pour absorber.
         */}
        {deviseChange && (
          <Notice tone="warn" icon="info">
            {t('app.parkSettings.currencyWarning')}
          </Notice>
        )}

      </form>
    </Modal>
  )
}
