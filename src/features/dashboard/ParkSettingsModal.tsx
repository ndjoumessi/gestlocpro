import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT, useI18n } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { countryOptions } from '@/lib/countries'
import { ApiError, api, DEVISES_DU_PARC, type DeviseDuParc } from '@/api/client'

/**
 * CORRIGER LE PARC : SON NOM, SON PAYS, SA DEVISE, SA DÉLÉGATION.
 *
 * Les trois sont posés à la création du parc et n'étaient modifiables nulle
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
  const { adhesionActive, rafraichir } = useSession()

  const parkId = adhesionActive?.parkId ?? null
  /**
   * Les valeurs d'origine, figées à l'ouverture.
   *
   * C'est à elles que la saisie est comparée pour savoir ce qui a changé : sans
   * cette référence, l'écran enverrait les trois champs à chaque fois et
   * réécrirait le pays et la devise avec ce qu'il croyait savoir en s'ouvrant.
   */
  const origine = useMemo(
    () => ({
      name: adhesionActive?.parkName ?? '',
      countryCode: adhesionActive?.countryCode ?? '',
      currency: (adhesionActive?.currency ?? '') as DeviseDuParc | '',
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

  const optionsDePays = useMemo(() => countryOptions(locale), [locale])

  const deviseChange = devise !== '' && devise !== origine.currency

  /** Ce qui a changé, et rien d'autre. Vide quand la saisie est celle d'origine. */
  const correction: {
    name?: string
    countryCode?: string
    currency?: DeviseDuParc
    delegation?: 'solo' | 'delegate'
  } = {}
  if (nom.trim() && nom.trim() !== origine.name) correction.name = nom.trim()
  if (pays && pays !== origine.countryCode) correction.countryCode = pays
  if (deviseChange) correction.currency = devise as DeviseDuParc
  if (delegation !== origine.delegation) correction.delegation = delegation

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    if (!parkId) return

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
    >
      <form onSubmit={enregistrer} noValidate className="flex flex-col gap-5">
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
            <Select
              {...props}
              name="countryCode"
              value={pays}
              onChange={(e) => setPays(e.target.value)}
            >
              {optionsDePays.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
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
              {DEVISES_DU_PARC.map((code) => (
                <option key={code} value={code}>
                  {t(`app.parkSettings.currency${code}` as 'app.parkSettings.currencyXAF')}
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

        <Button type="submit" loading={envoi} variant={deviseChange ? 'danger' : 'primary'}>
          {/* Le bouton NOMME le geste quand il devient irréversible : on ne
              clique pas par habitude sur « Enregistrer » quand ce qui part
              change l'unité de tous les montants du parc. */}
          {deviseChange ? t('app.parkSettings.confirmCurrency') : t('app.parkSettings.submit')}
        </Button>
      </form>
    </Modal>
  )
}
