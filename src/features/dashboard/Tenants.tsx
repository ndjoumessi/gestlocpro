import { useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { InviteModal } from './InviteModal'
import { Icon } from '@/components/primitives/Icon'
import { DataTable } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import { PaymentStatusPill } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useI18n, useT } from '@/i18n/I18nProvider'
import { useNumbers } from '@/lib/numbers'
import { dialOptions } from '@/lib/countries'
import { buildingById, type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { validateName, validatePhone, type FieldError } from '@/features/auth/validation'

export function Tenants() {
  const t = useT()
  const n = useNumbers()
  const { money } = useCurrency()
  const [open, setOpen] = useState(false)
  const [inviteOuverte, setInviteOuverte] = useState(false)

  // Unités partagées : rattacher un locataire doit se voir ici, dans le parc
  // immobilier et dans le taux d'occupation du tableau de bord.
  const { units, loading } = usePortfolio()

  const leases = units.filter((unit) => unit.tenant !== null)
  const vacant = units.filter((unit) => unit.tenant === null)

  /**
   * Le fichier des personnes.
   *
   * Dix noms et dix numéros de téléphone, cliquables, appelables. Le
   * gestionnaire n'a aucun moyen de savoir qu'ils ne sont pas les siens — un
   * nom camerounais plausible à côté d'un « A1 » plausible se lit comme une
   * fiche. Le geste au bout est un appel à un inconnu.
   */
  if (loading) return <TenantsSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.tenants.title')}
        description={t('app.tenants.subtitle')}
        actions={
          <>
            {/* L'invitation n'exige PAS de logement vacant : on peut inviter un
                gestionnaire, ou un locataire dont le bail se prépare. La lier à
                la disponibilité aurait bloqué les deux. */}
            <Button variant="secondary" icon="users" onClick={() => setInviteOuverte(true)}>
              {t('app.invite.button')}
            </Button>
            <Button icon="plus" onClick={() => setOpen(true)} disabled={vacant.length === 0}>
              {t('app.tenants.addTenant')}
            </Button>
          </>
        }
      />

      {inviteOuverte && <InviteModal open onClose={() => setInviteOuverte(false)} />}

      {/* Un bouton grisé sans motif laisse deviner. Quand tout est loué, il
          n'y a rien à quoi rattacher un locataire — on le dit. */}
      {vacant.length === 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.tenants.noVacantNotice')}
        </p>
      )}

      <DataTable<Unit>
        caption={t('app.tenants.title')}
        rows={leases}
        rowKey={(unit) => unit.id}
        columns={[
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) => (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-semibold text-muted"
                >
                  {unit.tenant
                    ?.split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span className="min-w-0 truncate font-medium">{unit.tenant}</span>
              </div>
            ),
          },
          {
            key: 'unit',
            header: t('app.portfolio.unit'),
            render: (unit) => (
              <span className="numeric">
                {unit.label}
                <span className="ml-2 text-caps text-muted">
                  {buildingById(unit.buildingId)?.district}
                </span>
              </span>
            ),
          },
          {
            key: 'type',
            header: `${t('app.portfolio.type')} · ${t('app.portfolio.surface')}`,
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
              </span>
            ),
          },
          {
            // La colonne était partie sans que ses clés le soient :
            // `app.tenants.contact` restait défini dans les deux langues sans
            // aucun appelant. Le numéro est maintenant conservé — l'afficher
            // est ce qui rend crédible le fait de le demander.
            key: 'contact',
            header: t('app.tenants.contact'),
            hideOnMobile: true,
            render: (unit) =>
              unit.phone ? (
                <a
                  href={`tel:${unit.phone.replace(/\s/g, '')}`}
                  className="numeric inline-flex min-h-11 items-center text-muted no-underline hover:text-ink hover:underline"
                >
                  {unit.phone}
                </a>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
          {
            key: 'rent',
            header: t('app.portfolio.rent'),
            numeric: true,
            render: (unit) => money(unit.rent, { round: true }),
          },
          {
            key: 'status',
            header: t('app.portfolio.status'),
            render: (unit) => <PaymentStatusPill status={unit.status} size="sm" />,
          },
        ]}
      />

      {/* Le deux-points était concaténé dans le JSX, précédé d'une espace :
          une règle typographique française servie telle quelle en anglais.
          Il vit maintenant dans la clé, avec la conjonction de la liste. */}
      {vacant.length > 0 && (
        <p className="mt-4 text-body-s text-muted">
          {t('app.tenants.vacantList', {
            count: vacant.length,
            units: n.list(vacant.map((unit) => unit.label)),
          })}
        </p>
      )}

      {open && <NewTenantModal vacant={vacant} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Les locataires, le temps que le parc arrive.
 *
 * Les deux actions sont retenues. « Inviter » émettrait un code d'accès à un
 * parc dont on n'a pas encore la réponse ; « ajouter un locataire » ouvrirait
 * une liste de logements vacants tirée de la démonstration, et rattacherait
 * une personne réelle à un identifiant qui n'existe nulle part.
 *
 * La liste des logements vacants, en bas, n'est pas reproduite : elle est sous
 * le tableau, donc sous la ligne de flottaison, et son apparition allonge la
 * page sans déplacer ce qu'on regarde.
 */
function TenantsSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.tenants.title')}
        description={t('app.tenants.subtitle')}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-40" />
            <Skeleton radius="md" className="h-11 w-48" />
          </>
        }
      />

      <SkeletonRegion>
        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}

/**
 * Création d'une fiche locataire.
 *
 * Elle ne validait rien : soumise à vide, elle annonçait « code d'invitation
 * envoyé par SMS » pour un locataire sans nom et un numéro inexistant. Elle
 * emprunte désormais les validateurs de l'inscription — mêmes règles, mêmes
 * messages, une seule définition de ce qu'est un nom ou un téléphone valide.
 */
function NewTenantModal({ vacant, onClose }: { vacant: Unit[]; onClose: () => void }) {
  const t = useT()
  const { locale } = useI18n()
  const { notify } = useToast()
  const { parseAmount } = useCurrency()
  const { addTenant } = usePortfolio()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // Le champ était un `tel` nu, sans indicatif, alors que l'inscription en
  // pose un : un bailleur hors zone CFA créait une fiche dont le numéro ne
  // permettait pas d'envoyer le code promis par le libellé d'aide.
  const [dial, setDial] = useState('+237')
  const [debut, setDebut] = useState('')
  const [loyer, setLoyer] = useState('')
  const [caution, setCaution] = useState('')
  const [unitId, setUnitId] = useState(vacant[0]?.id ?? '')
  const formRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<{ name: FieldError; phone: FieldError }>({
    name: null,
    phone: null,
  })
  const [touched, setTouched] = useState({ name: false, phone: false })

  const submit = () => {
    const next = { name: validateName(name), phone: validatePhone(phone, dial) }
    setErrors(next)
    setTouched({ name: true, phone: true })

    if (next.name || next.phone) {
      // La recherche est bornée à la modale. Elle portait sur tout le
      // document : aucun autre `[name="name"]` n'existe aujourd'hui, mais rien
      // ne garantissait qu'il n'en apparaîtrait pas, et le focus serait alors
      // parti sur un champ d'un autre écran.
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${next.name ? 'name' : 'phone'}"]`)
        ?.focus()
      return
    }

    /**
     * Les termes du bail voyagent avec le locataire.
     *
     * La création posait toujours « aujourd'hui » et le loyer de référence. Un
     * propriétaire qui déclare ses locataires DÉJÀ EN PLACE — le cas de tout
     * nouveau compte — enregistrait donc de fausses dates, et l'ancienneté
     * comme les impayés cumulés en découlaient faux.
     */
    const loyerLu = loyer.trim() ? parseAmount(loyer) : null
    addTenant(unitId, name.trim(), `${dial} ${phone.trim()}`, {
      ...(debut ? { startsOn: debut } : {}),
      ...(loyerLu !== null ? { rentMinor: loyerLu } : {}),
      ...(Number(caution) > 0 ? { depositMinor: Math.round(Number(caution)) } : {}),
    })
    onClose()
    notify(t('app.tenants.created'), { tone: 'ok' })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('app.tenants.modalTitle')}
      description={t('app.tenants.modalDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('common.save')}</Button>
        </>
      }
    >
      <div ref={formRef} className="flex flex-col gap-5">
        <Field
          label={t('common.fullName')}
          required
          error={touched.name && errors.name ? t(errors.name) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setTouched((s) => ({ ...s, name: true }))
                setErrors((s) => ({ ...s, name: validateName(name) }))
              }}
            />
          )}
        </Field>

        <Field
          label={t('common.phone')}
          required
          hint={t('app.tenants.phoneHint')}
          error={touched.phone && errors.phone ? t(errors.phone) : undefined}
        >
          {(props) => (
            <div className="flex gap-2">
              <div className="w-44 shrink-0">
                {/* Cherchable, comme à l'inscription.
                    Le menu natif alignait ici les deux cent quatre indicatifs
                    sans moyen d'en atteindre un : le correctif qui les a rendus
                    cherchables ne portait que sur l'écran d'inscription, et
                    cette modale — la seule autre à demander un numéro — était
                    restée en arrière. Deux champs pour la même donnée, dont un
                    seul praticable. */}
                <Combobox
                  aria-label={t('common.dialCode')}
                  autoComplete="tel-country-code"
                  options={dialOptions(locale).map(({ dial: code, label, zone }) => ({
                    value: code,
                    label,
                    groupe: t(zone === 'cfa' ? 'common.dialZoneCfa' : 'common.dialZoneOther'),
                  }))}
                  value={dial}
                  onChange={setDial}
                />
              </div>
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  setTouched((s) => ({ ...s, phone: true }))
                  setErrors((s) => ({ ...s, phone: validatePhone(phone, dial) }))
                }}
              />
            </div>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('app.tenants.leaseStart')} hint={t('app.tenants.leaseStartHint')} optional>
            {(props) => (
              <DatePicker
                id={props.id}
                aria-describedby={props['aria-describedby']}
                invalid={props['aria-invalid']}
                name="leaseStart"
                value={debut}
                onChange={setDebut}
              />
            )}
          </Field>
          <Field label={t('app.tenants.leaseRent')} hint={t('app.tenants.leaseRentHint')} optional>
            {(props) => (
              <Input
                {...props}
                name="leaseRent"
                inputMode="numeric"
                value={loyer}
                onChange={(e) => setLoyer(e.target.value)}
              />
            )}
          </Field>
          {/*
            La caution, qu'aucun écran ne demandait.

            Le serveur l'accepte depuis peu ; sans ce champ, aucun compte réel
            n'aurait jamais pu en enregistrer une — et l'écran « Cautions »
            serait resté vide quoi qu'on fasse, comme il l'était.

            Facultative : un locataire déjà en place dont on ne retrouve pas le
            montant doit pouvoir être déclaré. Fabriquer un chiffre serait pire
            que l'absence.
          */}
          <Field label={t('app.tenants.deposit')} hint={t('app.tenants.depositHint')} optional>
            {(props) => (
              <Input
                {...props}
                name="deposit"
                inputMode="numeric"
                value={caution}
                onChange={(e) => setCaution(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label={t('app.payments.selectUnit')} required>
          {(props) => (
            <Select
              {...props}
              name="unitId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              {vacant.map((unit) => (
                // La valeur reste l'identifiant technique — c'est elle qui part
                // à `addTenant` puis au serveur ; seul le texte lu est le libellé.
                <option key={unit.id} value={unit.id}>
                  {unit.label} — {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} ·{' '}
                  {buildingById(unit.buildingId)?.district}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
