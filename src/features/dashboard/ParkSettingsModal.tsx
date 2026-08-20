import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import { useT, useI18n } from '@/i18n/I18nProvider'
import { useSession } from '@/api/SessionProvider'
import { countryOptions } from '@/lib/countries'
import { api, DEVISES_DU_PARC, type DeviseDuParc } from '@/api/client'

/**
 * CORRIGER LE PARC : SON NOM, SON PAYS, SA DEVISE.
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
    }),
    [adhesionActive?.parkName, adhesionActive?.countryCode, adhesionActive?.currency],
  )

  const [nom, setNom] = useState(origine.name)
  const [pays, setPays] = useState(origine.countryCode)
  const [devise, setDevise] = useState<DeviseDuParc | ''>(origine.currency)
  const [envoi, setEnvoi] = useState(false)

  const optionsDePays = useMemo(() => countryOptions(locale), [locale])

  const deviseChange = devise !== '' && devise !== origine.currency

  /** Ce qui a changé, et rien d'autre. Vide quand la saisie est celle d'origine. */
  const correction: { name?: string; countryCode?: string; currency?: DeviseDuParc } = {}
  if (nom.trim() && nom.trim() !== origine.name) correction.name = nom.trim()
  if (pays && pays !== origine.countryCode) correction.countryCode = pays
  if (deviseChange) correction.currency = devise as DeviseDuParc

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    if (!parkId) return

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
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
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
        <Field label={t('app.parkSettings.name')} required>
          {(props) => (
            <Input {...props} name="name" value={nom} onChange={(e) => setNom(e.target.value)} />
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

        {/**
         * L'AVERTISSEMENT, et il ne paraît que si la devise change.
         *
         * Les montants sont stockés en unités mineures, sans devise attachée :
         * un loyer de 180 000 relu en euros reste 180 000, soit six cent
         * cinquante-six fois sa valeur. Le geste n'est pas interdit — le cas qui
         * l'appelle est le parc jeune qu'on resaisit — mais il se dit avant le
         * clic, et non après.
         */}
        {deviseChange && (
          <p className="flex items-start gap-2 rounded-lg border border-warn-border bg-warn-tint px-4 py-3.5 text-body-s text-warn">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {t('app.parkSettings.currencyWarning')}
          </p>
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
