import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { useT } from '@/i18n/I18nProvider'
import { useCurrency } from '@/currency/CurrencyProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import type { Unit } from '@/data/portfolio'

const TYPES: Unit['type'][] = ['T1', 'T2', 'T3', 'T4']

/**
 * Saisie d'un logement dans un immeuble.
 *
 * Le logement naît **vacant**, et le dire est important : le rattacher à un
 * locataire est un autre geste, sur un autre écran. Créer un logement déjà
 * occupé fausserait le taux d'occupation et les encaissements attendus dès la
 * première seconde.
 *
 * Le loyer est saisi dans la devise affichée et converti en unités mineures
 * entières — `parseAmount` porte déjà les conventions de chaque devise, et
 * refaire cette lecture ici produirait deux façons de lire « 145 000 ».
 */
export function AddUnitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { parseAmount } = useCurrency()
  const { buildings, units, addUnit } = usePortfolio()

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<Unit['type']>('T2')
  const [surface, setSurface] = useState('')
  const [rent, setRent] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const fermer = () => {
    setLabel('')
    setSurface('')
    setRent('')
    setErrors({})
    onClose()
  }

  const submit = () => {
    const surfaceLue = Number(surface.replace(/\s/g, ''))
    const loyerLu = parseAmount(rent)

    const suivant: Record<string, string | undefined> = {}
    if (!label.trim()) suivant.label = t('app.portfolio.unitLabelRequired')
    if (!Number.isInteger(surfaceLue) || surfaceLue <= 0)
      suivant.surface = t('app.portfolio.unitNumberInvalid')
    if (loyerLu === null || loyerLu < 0) suivant.rent = t('app.portfolio.unitNumberInvalid')
    /**
     * Doublon dans le MÊME immeuble.
     *
     * Le serveur le refuse déjà en 409 — c'est lui qui fait autorité, et une
     * requête peut ne pas venir de cet écran. On le vérifie aussi ici pour que
     * la correction se fasse sans aller-retour.
     *
     * La comparaison ignore la casse : « a1 » et « A1 » désignent le même
     * logement pour un humain, et produiraient deux lignes indiscernables.
     */
    const dejaPris = units.some(
      (u) => u.buildingId === buildingId && u.label.toLowerCase() === label.trim().toLowerCase(),
    )
    if (label.trim() && dejaPris) suivant.label = t('app.portfolio.unitLabelTaken')

    setErrors(suivant)
    if (Object.values(suivant).some(Boolean)) return

    addUnit(buildingId, { label: label.trim(), type, surface: surfaceLue, rent: loyerLu! })
    fermer()
  }

  return (
    <Modal
      open={open}
      onClose={fermer}
      title={t('app.portfolio.addUnitTitle')}
      description={t('app.portfolio.addUnitDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={fermer}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={buildings.length === 0}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {buildings.length === 0 ? (
        // Un logement se rattache à un immeuble : sans immeuble, le formulaire
        // n'a pas de sens et on le dit, plutôt que d'offrir un menu vide.
        <p className="text-body text-muted">{t('app.portfolio.noBuildingYet')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <Field label={t('app.portfolio.unitBuilding')} required>
            {(props) => (
              <Select
                {...props}
                name="buildingId"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.district}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('app.portfolio.unitLabel')} required error={errors.label}>
              {(props) => (
                <Input
                  {...props}
                  name="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t('app.portfolio.unitLabelPlaceholder')}
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

            <Field label={t('app.portfolio.unitSurface')} required error={errors.surface}>
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

            <Field label={t('app.portfolio.unitRent')} required error={errors.rent}>
              {(props) => (
                <Input
                  {...props}
                  name="rent"
                  inputMode="numeric"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>
      )}
    </Modal>
  )
}
