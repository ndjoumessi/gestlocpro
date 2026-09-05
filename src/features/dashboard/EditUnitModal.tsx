import { useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import type { Unit } from '@/data/portfolio'

const TYPES: Unit['type'][] = ['T1', 'T2', 'T3', 'T4']

/**
 * CORRIGER UN LOGEMENT — L'OBJET DU PARC QUI N'AVAIT AUCUNE ISSUE.
 *
 * L'immeuble se supprimait tant qu'il était vide ; la fiche locataire se
 * corrige depuis `ficheCorrigeable`. Le logement, lui, n'avait RIEN : ni
 * correction, ni suppression. Un numéro tapé à côté, une surface fausse, un
 * loyer à un zéro près restaient tels quels pour la vie du parc.
 *
 * ═══ LE LOYER EST UNE RÉFÉRENCE, ET LA MODALE LE DIT ═══
 *
 * Le serveur ne fait PAS redescendre ce loyer dans les baux ni dans les
 * échéances déjà appelées — le schéma l'exige : « changer le loyer ne doit pas
 * réécrire le passé ». Un utilisateur qui corrige « 7 000 » en « 70 000 » sur
 * un logement OCCUPÉ verrait donc la ligne changer et l'échéance du mois ne pas
 * bouger, sans que rien ne l'explique.
 *
 * D'où la note, et elle n'apparaît QUE sur un logement occupé : sur un logement
 * vacant il n'y a ni bail ni échéance, et la phrase parlerait d'un effet qui
 * n'existe pas. C'est la règle des notes conditionnelles — une `Notice` se
 * déclare avec le geste qui la fait apparaître.
 */
export function EditUnitModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const t = useT()
  const { updateUnit } = usePortfolio()
  const { notify } = useToast()
  const { parseAmount, enDeviseAffichee } = useCurrency()
  const [numero, setNumero] = useState(unit.label)
  const [type, setType] = useState<Unit['type']>(unit.type)
  const [surface, setSurface] = useState(String(unit.surface))
  /* LE LOYER S'OUVRE DANS LA DEVISE AFFICHÉE, parce que c'est dans celle-là
     qu'on le retapera : `parseAmount` reconvertit vers la devise du parc au
     moment d'enregistrer. Pré-remplir avec la valeur BRUTE ferait lire un
     nombre dans une unité et le relire dans une autre. */
  const [loyer, setLoyer] = useState(String(enDeviseAffichee(unit.rent)))
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const enregistrer = async () => {
    const surfaceLue = Number(surface.replace(/\s/g, ''))
    const loyerLu = parseAmount(loyer)

    /* LES MÊMES BORNES QUE LE SERVEUR, pour que le refus arrive sans
       aller-retour. Le serveur les tient de toute façon. */
    const suivant: Record<string, string | undefined> = {}
    if (!numero.trim()) suivant.label = t('app.portfolio.unitLabelRequired')
    if (!Number.isInteger(surfaceLue) || surfaceLue <= 0)
      suivant.surface = t('app.portfolio.unitNumberInvalid')
    if (loyerLu === null || loyerLu < 0) suivant.rent = t('app.portfolio.unitNumberInvalid')
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['label', 'surface', 'rent'] as const).find((champ) => suivant[champ])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[name="${premier}"]`)?.focus()
      return
    }

    setEnCours(true)
    const fait = await updateUnit(unit.id, {
      label: numero.trim(),
      type,
      surface: surfaceLue,
      rent: loyerLu!,
    })
    setEnCours(false)
    if (fait) {
      onClose()
      notify(t('app.portfolio.editUnitDone'), { tone: 'ok' })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('app.portfolio.editUnitTitle', { unit: unit.label })}
      description={t('app.portfolio.editUnitBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="correction-logement" disabled={enCours}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id="correction-logement"
        onSubmit={(e) => {
          e.preventDefault()
          void enregistrer()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('app.portfolio.unitLabel')} required error={erreurs.label}>
            {(props) => (
              <Input
                {...props}
                name="label"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('app.portfolio.unitType')} required>
            {(props) => (
              <Select
                {...props}
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as Unit['type'])}
              >
                {TYPES.map((code) => (
                  <option key={code} value={code}>
                    {t(`app.unitTypes.${code}` as 'app.unitTypes.T1')}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t('app.portfolio.unitSurface')} required error={erreurs.surface}>
            {(props) => (
              <Input
                {...props}
                name="surface"
                inputMode="numeric"
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('app.portfolio.unitRent')} required error={erreurs.rent}>
            {(props) => (
              <Input
                {...props}
                name="rent"
                inputMode="numeric"
                value={loyer}
                onChange={(e) => setLoyer(e.target.value)}
              />
            )}
          </Field>
        </div>

        {/* SEULEMENT SUR UN LOGEMENT OCCUPÉ — voir l'en-tête. Sur un logement
            vacant, il n'y a ni bail ni échéance et la phrase parlerait d'un
            effet qui n'existe pas. */}
        {unit.tenant ? <Notice tone="neutral">{t('app.portfolio.editUnitRentNote')}</Notice> : null}
      </form>
    </Modal>
  )
}
