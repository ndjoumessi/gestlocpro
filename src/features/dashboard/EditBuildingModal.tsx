import { useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import type { Immeuble } from '@/data/apiPortfolio'

/**
 * CORRIGER UN IMMEUBLE — LE SEUL CHEMIN QUI RESTE UNE FOIS QU'IL SERT.
 *
 * L'écran offrait UNE issue sur un immeuble : le supprimer, et seulement s'il
 * est VIDE. C'est écrit dans le rendu de la carte — « l'issue n'apparaît que
 * sur un immeuble VIDE ». Autrement dit : la faute de frappe était réparable
 * tant que l'immeuble ne servait à rien, et définitive dès le premier logement.
 *
 * Renommer n'emporte rien. Aucun bail, aucune somme, aucune ligne ne dépend de
 * l'orthographe d'un immeuble — seule la LECTURE en dépend, et c'est
 * exactement ce qu'on répare.
 *
 * LE QUARTIER EST DANS LA MODALE, et pas seulement le nom. Deux résidences d'un
 * même quartier sont distinguées par leur nom ; deux immeubles du même nom, par
 * leur quartier. Corriger l'un sans l'autre laisserait la moitié de ce qui
 * DÉSIGNE l'immeuble hors de portée.
 */
export function EditBuildingModal({
  immeuble,
  onClose,
}: {
  immeuble: Immeuble
  onClose: () => void
}) {
  const t = useT()
  const { updateBuilding } = usePortfolio()
  const { notify } = useToast()
  const [nom, setNom] = useState(immeuble.name)
  const [quartier, setQuartier] = useState(immeuble.district)
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const enregistrer = async () => {
    /* LES MÊMES BORNES QUE LE SERVEUR, posées ici pour que le refus arrive
       avant l'aller-retour. Le serveur les tient de toute façon — c'est lui qui
       décide —, et `signalerEchec` dirait le reste. */
    const suivant: Record<string, string | undefined> = {}
    if (nom.trim().length < 2) suivant.name = t('app.portfolio.buildingNameInvalid')
    if (quartier.trim().length < 2) suivant.district = t('app.portfolio.districtInvalid')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      /* LE FOCUS REJOINT LE PREMIER CHAMP FAUTIF, comme les trois autres
         formulaires de ce dossier. L'ordre suit celui du formulaire. */
      const premier = (['name', 'district'] as const).find((champ) => suivant[champ])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[name="${premier}"]`)?.focus()
      return
    }

    setEnCours(true)
    const fait = await updateBuilding(immeuble.id, {
      name: nom.trim(),
      district: quartier.trim(),
    })
    setEnCours(false)
    if (fait) {
      onClose()
      notify(t('app.portfolio.editBuildingDone'), { tone: 'ok' })
    }
    /* UN ÉCHEC NE FERME PAS LA MODALE : la saisie reste sous les yeux, et
       `signalerEchec` a déjà dit le refus. */
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('app.portfolio.editBuildingTitle', { name: immeuble.name })}
      description={t('app.portfolio.editBuildingBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="correction-immeuble" disabled={enCours}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {/* UN VRAI `<form>`, ET LE BOUTON DU PIED LUI EST RATTACHÉ par `form=` :
          `Modal` rend le corps et le pied dans deux `<div>` FRÈRES. Sans cela,
          Entrée ne valide rien et le clavier virtuel d'un téléphone perd sa
          touche d'action. Le motif entier est écrit dans `AddUnitModal`. */}
      <form
        ref={formRef}
        id="correction-immeuble"
        onSubmit={(e) => {
          e.preventDefault()
          void enregistrer()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label={t('app.portfolio.buildingName')} required error={erreurs.name}>
          {(props) => (
            <Input {...props} name="name" value={nom} onChange={(e) => setNom(e.target.value)} />
          )}
        </Field>
        <Field label={t('app.portfolio.district')} required error={erreurs.district}>
          {(props) => (
            <Input
              {...props}
              name="district"
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
