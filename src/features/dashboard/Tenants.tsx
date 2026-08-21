import { useRef, useState } from 'react'
import { PageHeader, useRole } from '@/components/layout/AppShell'
import { InviteModal } from './InviteModal'
import { AnnounceModal } from './AnnounceModal'
import { Icon } from '@/components/primitives/Icon'
import { Card, CardHeader } from '@/components/primitives/Card'
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
import { useDates } from '@/lib/useDates'
import { dialOptions } from '@/lib/countries'
import { DOCUMENT_KIND_LABELS, buildingById, type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { validateName, validatePhone, type FieldError } from '@/features/auth/validation'

export function Tenants() {
  const t = useT()
  const n = useNumbers()
  const d = useDates()
  const { money } = useCurrency()
  const [open, setOpen] = useState(false)
  const [inviteOuverte, setInviteOuverte] = useState(false)
  const [annonceOuverte, setAnnonceOuverte] = useState(false)

  // Unités partagées : rattacher un locataire doit se voir ici, dans le parc
  // immobilier et dans le taux d'occupation du tableau de bord.
  const { units, loading, removeTenant, documentRequests, resolveDocumentRequest, unitById } =
    usePortfolio()
  const [aRetirer, setARetirer] = useState<Unit | null>(null)
  const { role } = useRole()
  const { notify } = useToast()

  const leases = units.filter((unit) => unit.tenant !== null)
  /* Celles qui appellent un geste. Une demande déjà traitée n'a plus rien à
     faire dans une liste de travail — elle reste lisible chez le locataire,
     qui est celui que la réponse concerne. */
  const demandesEnAttente = documentRequests.filter((d) => d.status === 'pending')
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
            {/*
              PRÉVENIR TOUT LE MONDE D'UN COUP.

              Le seul envoi à plusieurs destinataires du produit était la relance
              d'impayés, sans texte libre. Une coupure d'eau annoncée jeudi se
              transmettait au téléphone, locataire par locataire, et ce qui avait
              été dit ne laissait aucune trace.

              Il vit sur le FICHIER DES PERSONNES et non sur le parc immobilier :
              on écrit à des gens, pas à des murs, et c'est ici qu'on lit qui ils
              sont. Grisé quand personne n'est en place — le serveur rendrait 404
              sur un parc sans bail actif, et un bouton qui ne peut qu'échouer
              vaut moins qu'un bouton qui dit pourquoi.
            */}
            <Button
              variant="secondary"
              icon="bell"
              onClick={() => setAnnonceOuverte(true)}
              disabled={leases.length === 0}
            >
              {t('app.announce.button')}
            </Button>
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
      {annonceOuverte && <AnnounceModal open onClose={() => setAnnonceOuverte(false)} />}

      {/* Un bouton grisé sans motif laisse deviner. Quand tout est loué, il
          n'y a rien à quoi rattacher un locataire — on le dit. */}
      {vacant.length === 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-gold-border bg-gold-tint px-3.5 py-3 text-body-s text-gold-ink">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          {t('app.tenants.noVacantNotice')}
        </p>
      )}

      {/*
        LES DEMANDES DE PIÈCES.

        Elles arrivaient jusqu'ici par le canal des signalements, faute d'objet
        pour les porter : « Attestation de résidence » s'affichait dans la liste
        des travaux, avec un métier, une urgence et une référence de chantier,
        entre une fuite d'évier et un volet cassé. Le gestionnaire pouvait la
        clore comme on clôt un chantier — sans que rien ne dise au locataire si
        sa pièce était fournie ou refusée.

        Sur l'écran des LOCATAIRES et non sur celui des travaux : une pièce
        administrative se rattache à une personne, pas à un logement.

        La carte n'existe que s'il y a quelque chose à traiter. Une section
        « Demandes de documents » vide sur un parc calme occuperait la place
        d'une commande utile en laissant croire qu'il y a quelque chose à voir.
      */}
      {demandesEnAttente.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title={t('app.documents.pending')}
            description={t('app.documents.pendingHint')}
            level={2}
          />
          <ul
            aria-label={t('app.documents.pending')}
            className="flex flex-col divide-y divide-divider"
          >
            {demandesEnAttente.map((demande) => (
              <li
                key={demande.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-medium">
                    {t(DOCUMENT_KIND_LABELS[demande.kind] as 'app.documents.reqResidence')}
                  </p>
                  <p className="mt-0.5 text-caps text-muted">
                    {/* Le NOM d'abord : c'est à une personne qu'on répond. Le
                        libellé du logement se relit depuis le parc — afficher
                        `demande.unitId` montrerait un uuid. */}
                    {demande.tenant ?? unitById(demande.unitId)?.tenant ?? ''}
                    {' · '}
                    {unitById(demande.unitId)?.label ?? ''}
                    {' · '}
                    {t('app.documents.requestedOn', { date: d.fullDate(demande.requestedAt) })}
                  </p>
                </div>
                <div className="-mr-3.5 flex flex-wrap items-center gap-1">
                  {/*
                    DEUX réponses, et le refus n'est pas caché derrière la
                    première. Une pièce qu'on ne peut pas produire — bail non
                    signé, document inexistant — laisserait sinon la demande en
                    attente indéfiniment : le locataire guetterait, et cette
                    ligne ne partirait jamais d'ici.
                  */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resolveDocumentRequest(demande.id, 'declined')
                      notify(t('app.documents.resolvedToast'), { tone: 'ok' })
                    }}
                  >
                    {t('app.documents.markDeclined')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      resolveDocumentRequest(demande.id, 'fulfilled')
                      notify(t('app.documents.resolvedToast'), { tone: 'ok' })
                    }}
                  >
                    {t('app.documents.markFulfilled')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
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
          {
            key: 'retrait',
            header: '',
            render: (unit) =>
              /*
                Le retrait d'une fiche, qui n'existait pas.

                Même manque que les immeubles : on pouvait créer et jamais
                défaire. Offert au seul PROPRIÉTAIRE — retirer une fiche efface
                une personne du registre — et seulement quand une fiche existe.

                Le serveur refuse de toute façon tant qu'une somme a circulé ;
                ce masquage évite d'offrir un geste sur une ligne vacante, il ne
                remplace pas la règle.
              */
              role === 'owner' && unit.tenant && unit.tenantId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="close"
                  onClick={() => setARetirer(unit)}
                >
                  {t('app.tenants.remove')}
                </Button>
              ) : null,
          },
        ]}
      />

      {/* Le deux-points était concaténé dans le JSX, précédé d'une espace :
          une règle typographique française servie telle quelle en anglais.
          Il vit maintenant dans la clé, avec la conjonction de la liste. */}
      {aRetirer && (
        <Modal
          open
          onClose={() => setARetirer(null)}
          role="alertdialog"
          size="sm"
          title={t('app.tenants.removeTitle', { name: aRetirer.tenant ?? '' })}
          description={t('app.tenants.removeBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setARetirer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                /**
                 * Le message SUIT la réponse du serveur.
                 *
                 * Première version : le succès était annoncé dans le même souffle
                 * que l'appel, sans l'attendre. Le serveur refusait en 409 —
                 * « aucune somme n'a circulé » n'était pas satisfait — et l'écran
                 * affichait « Fiche retirée » PUIS « le serveur a refusé cette
                 * action » : deux messages contradictoires côte à côte, dont le
                 * premier était faux.
                 *
                 * C'est le défaut que ce produit corrige depuis le matin,
                 * réintroduit par celui qui le corrigeait. Le refus, lui, est
                 * déjà dit par `signalerEchec` : rien à ajouter ici.
                 */
                onClick={async () => {
                  const retire = await removeTenant(aRetirer.id, aRetirer.tenantId!)
                  setARetirer(null)
                  if (retire) notify(t('app.tenants.removed'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-body-s text-muted">
            {t('app.tenants.removeUnit', { unit: aRetirer.label })}
          </p>
        </Modal>
      )}

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
  /* Le vol en cours. Il éteint le bouton, faute de quoi l'attente désormais
     visible invite à recliquer — et deux fiches partiraient pour une personne. */
  const [envoi, setEnvoi] = useState(false)

  const submit = async () => {
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
    const cautionLue = caution.trim() ? parseAmount(caution) : null
    /**
     * LA CAUTION se lisait par `Number(caution)`, le loyer par `parseAmount` —
     * deux façons de lire l'argent dans le même appel, à trois lignes d'écart,
     * ce qu'`AddUnitModal` interdit explicitement. « 145 000 » recopié depuis
     * l'écran rendait `NaN`, `NaN > 0` était faux, et le locataire naissait
     * sans caution consignée pendant que le toast disait « locataire créé ».
     * L'écran des cautions n'avait alors plus rien à arbitrer, et rien nulle
     * part ne disait qu'il manquait quelque chose.
     *
     * Un montant SAISI mais illisible arrête la création. Un toast plutôt
     * qu'une erreur de champ : c'est déjà l'idiome de `TariffsModal`, du même
     * dossier, et cette modale ne tient d'erreurs que pour le nom et le
     * téléphone — leur en ajouter une troisième relèverait d'un autre sujet.
     */
    const loyerFautif = loyer.trim() !== '' && (loyerLu === null || loyerLu < 0)
    const cautionFautive = caution.trim() !== '' && (cautionLue === null || cautionLue < 0)
    if (loyerFautif || cautionFautive) {
      notify(t('common.amountUnreadable'), { tone: 'danger' })
      return
    }

    /**
     * LE SUCCÈS SUIT LA RÉPONSE, comme au retrait d'une fiche trois cents lignes
     * plus haut — même défaut, même écran, et l'un corrigé sans l'autre.
     *
     * `addTenant` partait sans qu'on l'attende. Sur un 409 — l'unité porte déjà
     * un bail en cours, ce que l'index unique de la base tranche seul, et deux
     * onglets ouverts suffisent à l'obtenir — le bailleur lisait « Fiche
     * locataire créée » puis « le serveur a refusé cette action ». Deux phrases
     * contradictoires côte à côte, dont la première était fausse, et la modale
     * s'était déjà refermée sur une saisie perdue.
     */
    setEnvoi(true)
    const creee = await addTenant(unitId, name.trim(), `${dial} ${phone.trim()}`, {
      ...(debut ? { startsOn: debut } : {}),
      ...(loyerLu !== null ? { rentMinor: loyerLu } : {}),
      ...(cautionLue !== null && cautionLue > 0
        ? { depositMinor: Math.round(cautionLue) }
        : {}),
    })
    setEnvoi(false)
    // La modale RESTE ouverte sur un refus : la saisie est encore là, et le
    // motif est déjà dit par `signalerEchec`. La refermer punirait le bailleur
    // d'un conflit qui n'est pas le sien.
    if (!creee) return
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
          <Button variant="secondary" onClick={onClose} disabled={envoi}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={envoi}>
            {t('common.save')}
          </Button>
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
