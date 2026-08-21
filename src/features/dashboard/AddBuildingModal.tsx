import { useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'

/**
 * Saisie d'un immeuble : un nom, un quartier.
 *
 * Première pierre de la constitution d'un parc. Jusqu'ici un propriétaire
 * pouvait créer son compte et n'en rien faire — indicateurs, encaissements,
 * relevés, cautions et travaux opéraient tous sur un parc qu'aucun écran ne
 * permettait de constituer.
 *
 * Ni nombre de logements ni taux d'occupation ne sont demandés : ce sont des
 * comptages, dérivés des unités. Les saisir créerait deux vérités sur la même
 * chose, et elles divergeraient au premier logement ajouté — c'est exactement
 * ce qui produisait déjà des « 0/0 » contradictoires à l'écran.
 */
export function AddBuildingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { addBuilding } = usePortfolio()

  const [name, setName] = useState('')
  const [district, setDistrict] = useState('')
  const [errors, setErrors] = useState<{ name?: string; district?: string }>({})
  // Portée à la recherche du champ fautif après un refus — voir `submit`.
  const formRef = useRef<HTMLFormElement>(null)

  const fermer = () => {
    setName('')
    setDistrict('')
    setErrors({})
    onClose()
  }

  const submit = () => {
    // Les mêmes bornes que le serveur, pour que le refus se lise avant l'appel
    // plutôt qu'après. Le serveur revérifie : c'est lui qui fait autorité, et
    // une requête peut ne pas venir de cet écran.
    const suivant: { name?: string; district?: string } = {}
    if (name.trim().length < 2) suivant.name = t('app.portfolio.buildingNameInvalid')
    if (district.trim().length < 2) suivant.district = t('app.portfolio.districtInvalid')
    setErrors(suivant)
    if (Object.keys(suivant).length > 0) {
      /**
       * LE FOCUS REJOINT LE PREMIER CHAMP FAUTIF, comme sur la fiche locataire
       * (`NewTenantModal`, dans ce même dossier).
       *
       * Le message d'erreur s'affichait déjà sous le champ, mais rien ne l'y
       * amenait : au clavier, la touche suivante après « Enregistrer » restait
       * « Annuler », et il fallait remonter à la main jusqu'au champ que le
       * message désignait. `role="alert"` annonce le texte à un lecteur
       * d'écran, mais n'y déplace pas le focus des autres.
       */
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${suivant.name ? 'buildingName' : 'district'}"]`)
        ?.focus()
      return
    }

    addBuilding(name.trim(), district.trim())
    fermer()
  }

  return (
    <Modal
      open={open}
      onClose={fermer}
      title={t('app.portfolio.addBuildingTitle')}
      description={t('app.portfolio.addBuildingDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={fermer}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="ajout-immeuble">{t('common.save')}</Button>
        </>
      }
    >
      {/*
        UN VRAI `<form>`, ET LE BOUTON DU PIED LUI EST RATTACHÉ.

        `Modal` rend le corps et le pied dans deux `<div>` FRÈRES : un `<form>`
        autour du corps ne peut donc pas contenir le bouton du pied. Faute de
        l'avoir résolu, cette modale n'avait pas de formulaire du tout — et
        Entrée n'y validait rien.

        Le coût n'est pas seulement au clavier. Sur un clavier virtuel de
        téléphone, un champ hors formulaire perd la touche d'action « Aller » :
        le clavier reste ouvert par-dessus la barre d'actions, au moment précis
        où il faut l'atteindre.

        L'attribut `form` est fait pour ce cas — un bouton peut soumettre un
        formulaire qui ne le contient pas. `noValidate` est indispensable :
        sans lui, la validation native rouvre ses bulles à côté des messages de
        `Field`, ce qui est exactement pourquoi les autres modales du dossier le
        portent déjà.
      */}
      <form ref={formRef} id="ajout-immeuble" onSubmit={(e) => {
          // `preventDefault` : sans lui, le formulaire part NATIVEMENT et
          // recharge la page — l'envoi se fait par `api`, jamais par le
          // navigateur.
          e.preventDefault()
          submit()
        }} noValidate className="flex flex-col gap-5">
        <Field label={t('app.portfolio.buildingName')} required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              name="buildingName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('app.portfolio.buildingNamePlaceholder')}
            />
          )}
        </Field>

        <Field label={t('app.portfolio.district')} required error={errors.district}>
          {(props) => (
            <Input
              {...props}
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder={t('app.portfolio.districtPlaceholder')}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
