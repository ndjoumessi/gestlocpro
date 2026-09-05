import { useEffect, useRef, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { PageHeader } from '@/components/layout/PageHeader'
import { InviteModal } from './InviteModal'
import { AnnounceModal } from './AnnounceModal'
import { Notice } from '@/components/primitives/Notice'
import { Card, CardHeader } from '@/components/primitives/Card'
import { DataTable } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useI18n, useT } from '@/i18n/I18nProvider'
import { useNumbers } from '@/lib/numbers'
import { useDates } from '@/lib/useDates'
import { dialOptions } from '@/lib/countries'
import { INDICATIFS } from '@/lib/indicatifs'
import { useSession } from '@/api/SessionProvider'
import { api } from '@/api/client'
import { ACCES_DEMO, DOCUMENT_KIND_LABELS, buildingById, type Unit } from '@/data/portfolio'
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
  const [aCorriger, setACorriger] = useState<Unit | null>(null)
  const [aRetirer, setARetirer] = useState<Unit | null>(null)
  const { role } = useRole()
  const base = useBase()
  const { notify } = useToast()

  const leases = units.filter((unit) => unit.tenant !== null)
  /* Celles qui appellent un geste. Une demande déjà traitée n'a plus rien à
     faire dans une liste de travail — elle reste lisible chez le locataire,
     qui est celui que la réponse concerne. */
  const demandesEnAttente = documentRequests.filter((d) => d.status === 'pending')
  const vacant = units.filter((unit) => unit.tenant === null)
  /* Les fiches en place dont AUCUN compte ne porte le nom. `=== false` et non
     `!`: absent vaut « reliée », un serveur antérieur au champ ne le rend pas. */
  const sansCompte = units.filter((unit) => unit.tenant !== null && unit.tenantHasAccount === false)

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
            {/* PRÉVENIR PASSE DERRIÈRE LES TROIS POINTS. C'est un geste de
                circonstance — une coupure d'eau, un passage d'artisan —, pas un
                geste quotidien ; inviter et créer une fiche le sont. Rien n'est
                retiré : le menu le rend, avec son propre motif de grisement. */}
            <Button variant="secondary" icon="users" onClick={() => setInviteOuverte(true)}>
              {t('app.invite.button')}
            </Button>
            <Button icon="plus" onClick={() => setOpen(true)} disabled={vacant.length === 0}>
              {t('app.tenants.addTenant')}
            </Button>
          </>
        }
        debordement={
          <MenuDeDebordement libelle={t('common.moreActions')}>
            <MenuElement icone="bell" onClick={() => setAnnonceOuverte(true)}>
              {t('app.announce.button')}
            </MenuElement>
          </MenuDeDebordement>
        }
      />

      {inviteOuverte && <InviteModal open onClose={() => setInviteOuverte(false)} />}
      {annonceOuverte && <AnnounceModal open onClose={() => setAnnonceOuverte(false)} />}

      {/*
        L'ÉCRAN COMPTAIT TROIS CHOSES ET N'EN MONTRAIT AUCUNE.

        Les baux, le loyer qu'ils appellent, les pièces demandées : les trois
        étaient déjà calculés au-dessus. `vacant` ne servait qu'à griser un
        bouton, `demandesEnAttente` qu'à décider d'afficher une carte. On
        arrivait donc sur un tableau de dix lignes sans un seul nombre, quand
        les six écrans voisins ouvrent tous sur une rangée de cartes.

        LE LOYER MENSUEL EST CELUI DES BAUX ACTIFS, et non du parc : un logement
        vacant n'appelle rien. C'est aussi ce qui rend la note du premier
        indicateur utile — le vacant est la différence entre les deux.

        L'ÉTAT SUR LES DEMANDES, et sur elles seules : une pièce demandée attend
        une réponse de l'utilisateur. Zéro demande rend la carte neutre.
      */}
      {/* LA CONSÉQUENCE, QUE LA PASTILLE SEULE NE DIT PAS.

          Une pastille nomme un état ; elle ne dit pas ce qu'il coûte. Ce qu'il
          coûte est précis : ce locataire n'a AUCUN espace où lire son bail, ses
          quittances ni ses relevés, il ne recevra aucune annonce, et le geste
          qui répare vit sur un autre écran. Le produit tient déjà ce langage
          sur l'annonce — « un locataire sans compte ne recevra rien, il n'a pas
          d'espace où lire » —, il manquait ici.

          UNIQUEMENT AU BAILLEUR : le locataire lit ce tableau borné à son
          propre bail, et lui annoncer qu'il n'a pas de compte, dans son espace,
          n'aurait aucun sens. */}
      {role !== 'tenant' && sansCompte.length > 0 && (
        <Notice className="mb-6">
          {t('app.tenants.noAccountNotice', { count: sansCompte.length })}
          <span className="mt-2 block">
            <Button to={lien(base, 'acces')} variant="secondary" size="sm" iconAfter="arrowRight">
              {t('app.tenants.noAccountAction')}
            </Button>
          </span>
        </Notice>
      )}

      <div className={`${GRILLE_TROIS_INDICATEURS} mb-6`}>
        <StatCard
          icone="users"
          label={t('app.tenants.kpiLeases')}
          value={String(leases.length)}
          note={t('app.tenants.kpiLeasesNote', { count: vacant.length })}
        />
        <StatCard
          icone="card"
          label={t('app.tenants.kpiRent')}
          value={money(
            leases.reduce((somme, unit) => somme + unit.rent, 0),
            { compact: true },
          )}
          note={t('app.tenants.kpiRentNote')}
        />
        <StatCard
          icone="file"
          label={t('app.tenants.kpiRequests')}
          value={String(demandesEnAttente.length)}
          etat={demandesEnAttente.length > 0 ? { ton: 'warn' } : undefined}
          note={t('app.tenants.kpiRequestsNote')}
        />
      </div>

      {/* Un bouton grisé sans motif laisse deviner. Quand tout est loué, il
          n'y a rien à quoi rattacher un locataire — on le dit. */}
      {vacant.length === 0 && (
        <Notice className="mb-4">{t('app.tenants.noVacantNotice')}</Notice>
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
        fiches
        columns={[
          {
            key: 'tenant',
            role: 'identite',
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
                {/* `data-donnee` : un nom de locataire est saisi, sa longueur
                    n'est bornée par rien, et la colonne d'un tableau l'est. La
                    coupe est donc assumée — voir `MESURER_TRONCATURES`. */}
                <span data-donnee className="min-w-0 truncate font-medium">
                  {unit.tenant}
                </span>
                {/* SANS COMPTE : l'état que deux écrans se cachaient l'un à
                    l'autre. Le statut du BAIL — « À jour » — ne dit rien de
                    l'ACCÈS, et le bailleur concluait de l'un sur l'autre : un
                    locataire en place, à jour, dans un logement, et pas la
                    moindre raison d'aller vérifier ailleurs. Pendant ce temps
                    l'intéressé lisait « aucun logement rattaché à votre
                    compte ». `StatusPill` porte déjà un mot à côté de sa
                    teinte, ce que `couleur-non-seule` exige. */}
                {unit.tenantHasAccount === false && (
                  <StatusPill tone="warn" size="sm">
                    {t('app.tenants.noAccount')}
                  </StatusPill>
                )}
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
            //
            // PAS `hideOnMobile`, à rebours des colonnes voisines. Ce fichier
            // s'ouvre sur « Dix noms et dix numéros de téléphone, cliquables,
            // appelables » — le numéro n'est pas une donnée secondaire ici,
            // c'est le geste que l'écran existe pour permettre, et sur le
            // marché que ce produit sert, la lecture se fait d'abord sur un
            // téléphone. Le masquer sous `sm` aurait retiré le seul geste
            // utile à qui consulte cette liste depuis le sien.
            key: 'contact',
            header: t('app.tenants.contact'),
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
            role: 'valeur',
            header: t('app.portfolio.rent'),
            numeric: true,
            render: (unit) => money(unit.rent, { compact: true }),
          },
          {
            key: 'status',
            role: 'etat',
            header: t('app.tenants.rentStatus'),
            render: (unit) => <PaymentStatusPill status={unit.status} size="sm" />,
          },
          {
            /*
              LES DEUX GESTES DANS UNE SEULE COLONNE, ET C'EST STRUCTUREL.

              `DataTable` épingle chaque colonne de rôle `geste` avec
              `sticky right-0`. UNE seule s'y colle sans dommage ; DEUX s'y
              superposent, et la dernière rendue rogne la précédente — « Corriger »
              s'affichait « Corı » sur la production, la moitié du mot mangée.

              LES DÉCALER AURAIT DEMANDÉ DE CONNAÎTRE LEUR LARGEUR, qui dépend du
              libellé traduit — « Retirer » et « Remove » ne font pas la même —, et
              la figer en dur rouvrirait le défaut dans l'autre langue.

              CORRIGER est ouvert au GESTIONNAIRE, RETIRER au seul propriétaire :
              deux conditions dans une cellule plutôt que deux colonnes. Retirer
              efface une personne du registre ; corriger une coquille est
              strictement moins puissant que créer la fiche, que le gestionnaire
              fait déjà.
            */
            /* `gap-2` ET NON `gap-1` sur la rangée ci-dessous : c'est le standard
               maison pour deux commandes qui se suivent, et `ecarts.test.ts` le
               refuse en deçà — deux cibles à 4 px l'une de l'autre se touchent au
               doigt. Écrit `gap-1` en première rédaction, refusé par la porte. */
            key: 'gestes',
            role: 'geste',
            header: '',
            render: (unit) =>
              unit.tenant && unit.tenantId ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="sliders"
                    onClick={() => setACorriger(unit)}
                  >
                    {t('app.tenants.edit')}
                  </Button>
                  {/* Le serveur refuse de toute façon tant qu'une somme a
                      circulé ; ce masquage évite d'offrir un geste sur une ligne
                      qui n'y a pas droit, il ne remplace pas la règle. */}
                  {role === 'owner' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="close"
                      onClick={() => setARetirer(unit)}
                    >
                      {t('app.tenants.remove')}
                    </Button>
                  ) : null}
                </div>
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
          <p className="text-body text-muted">
            {t('app.tenants.removeUnit', { unit: aRetirer.label })}
          </p>
        </Modal>
      )}

      {vacant.length > 0 && (
        <p className="mt-4 text-body text-muted">
          {t('app.tenants.vacantList', {
            count: vacant.length,
            units: n.list(vacant.map((unit) => unit.label)),
          })}
        </p>
      )}

      {aCorriger && (
        <CorrigerFicheModal unit={aCorriger} onClose={() => setACorriger(null)} />
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
/** Un membre du registre des accès, réduit à ce que ce champ en lit. */
interface MembreReliable {
  role: string
  userId: string
  tenantId: string | null
  fullName: string
  email: string
}

/**
 * Les membres qu'on peut relier, et eux seuls — le MÊME tri que les refus du
 * serveur, pour ne jamais proposer un geste qui reviendra refusé.
 *
 * `role === 'tenant'` : un gestionnaire opère tout le parc et n'a pas de fiche
 * (`not_a_tenant`). `!tenantId` : un compte déjà relié en porte une, et
 * `Tenant.userId` est unique sur toute la base (`account_already_linked`).
 */
function membresReliables(membres: MembreReliable[]): MembreReliable[] {
  return membres.filter((m) => m.role === 'tenant' && !m.tenantId)
}

/**
 * CORRIGER UNE FICHE : le nom et le numéro, rien d'autre.
 *
 * ═══ CE QUE SON ABSENCE COÛTAIT ═══
 *
 * Le produit savait ouvrir une fiche et la retirer, jamais la corriger. Une
 * coquille dans un nom n'avait donc qu'un chemin — supprimer pour recréer —,
 * qui emporte le BAIL et son ancienneté, et qui se referme au premier versement
 * encaissé : la suppression rend alors 409. Passé le premier loyer, une faute de
 * frappe était définitive.
 *
 * Relevé sur la production, colonne « Contact » : `+23760000001`, huit chiffres
 * là où le Cameroun en attend neuf. Le numéro était affiché, cliquable, et
 * n'appellerait jamais personne.
 *
 * ═══ CE QUE LA MODALE N'OFFRE PAS, ET LE DIT ═══
 *
 * Ni le loyer, ni le logement, ni le compte. Son corps le nomme plutôt que de
 * laisser chercher : un écran qui tait ce qu'il ne fait pas envoie l'utilisateur
 * fouiller les autres.
 *
 * ═══ LE NUMÉRO VIDE EFFACE, ET C'EST VOULU ═══
 *
 * Un numéro FAUX vaut moins que pas de numéro : le produit dit alors « pas de
 * contact » au lieu d'en promettre un qui ne sonne pas. L'aide du champ le dit.
 */
function CorrigerFicheModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const t = useT()
  const { updateTenant } = usePortfolio()
  const { notify } = useToast()
  const [nom, setNom] = useState(unit.tenant ?? '')
  const [numero, setNumero] = useState(unit.phone ?? '')
  /* `unit.email` VIENT DU PORTEFEUILLE, comme le téléphone : la fiche porte son
     adresse, et la modale l'ouvre telle quelle pour la corriger. */
  const [courriel, setCourriel] = useState(unit.email ?? '')
  const [erreurNom, setErreurNom] = useState<string | undefined>()
  const [enCours, setEnCours] = useState(false)

  const enregistrer = async () => {
    /* LA MÊME BORNE QUE LE SERVEUR, posée ici pour que le refus arrive avant
       l'aller-retour. Le serveur la tient de toute façon — c'est lui qui
       décide —, et `signalerEchec` dirait le reste. */
    if (nom.trim().length < 2) {
      setErreurNom(t('app.tenants.editNameInvalid'))
      return
    }
    setErreurNom(undefined)
    setEnCours(true)
    /* LA CHAÎNE VIDE PART TELLE QUELLE : c'est elle qui EFFACE le numéro côté
       serveur. L'omettre ne toucherait à rien, et le champ vidé n'aurait aucun
       effet — un geste sans conséquence, que rien n'expliquerait. */
    const fait = await updateTenant(unit.id, unit.tenantId!, {
      fullName: nom.trim(),
      phoneE164: numero.trim(),
      /* LA CHAÎNE VIDE EFFACE, côté serveur comme le numéro : une adresse fausse
         vaut moins que pas d'adresse — on écrirait dans le vide en croyant
         prévenir. */
      email: courriel.trim(),
    })
    setEnCours(false)
    if (fait) {
      onClose()
      notify(t('app.tenants.editSaved'), { tone: 'ok' })
    }
    /* UN ÉCHEC NE FERME PAS LA MODALE : la saisie reste sous les yeux, et
       `signalerEchec` a déjà dit le refus. La refermer obligerait à tout
       ressaisir pour corriger un caractère. */
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('app.tenants.editTitle', { name: unit.tenant ?? '' })}
      description={t('app.tenants.editBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={enregistrer} disabled={enCours}>
            {t('app.tenants.editSave')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('app.tenants.editName')} required error={erreurNom}>
          {(props) => (
            <Input
              id={props.id}
              aria-describedby={props['aria-describedby']}
              invalid={props['aria-invalid']}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('app.tenants.email')} hint={t('app.tenants.emailHint')} optional>
          {(props) => (
            <Input
              id={props.id}
              aria-describedby={props['aria-describedby']}
              type="email"
              inputMode="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
            />
          )}
        </Field>
                <Field label={t('app.tenants.editPhone')} hint={t('app.tenants.editPhoneHint')}>
          {(props) => (
            <Input
              id={props.id}
              aria-describedby={props['aria-describedby']}
              type="tel"
              inputMode="tel"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}

function NewTenantModal({ vacant, onClose }: { vacant: Unit[]; onClose: () => void }) {
  const t = useT()
  const { locale } = useI18n()
  const { notify } = useToast()
  const { parseAmount } = useCurrency()
  const { addTenant } = usePortfolio()
  const { adhesionActive, estDemo } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [courriel, setCourriel] = useState('')
  /**
   * LE COMPTE À QUI CETTE FICHE APPARTIENT — le champ qui empêche l'orphelin.
   *
   * ═══ CE QUE SON ABSENCE FABRIQUAIT ═══
   *
   * L'ordre qui produit une fiche sans compte est celui que le produit
   * RECOMMANDE : l'aide du champ d'invitation dit « sans logement, il rejoint
   * le parc sans bail, vous l'y rattacherez ensuite ». On invite d'abord, le
   * compte entre, on crée la fiche — et cette modale ne demandait jamais qui
   * était déjà là. Le locataire, membre du parc, un bail à son nom, lisait
   * « aucun logement rattaché à votre compte ». Deux lots ont livré des gestes
   * de RÉPARATION ; celui-ci retire la faute d'origine.
   *
   * ═══ IL NE PARAÎT QUE S'IL Y A QUELQU'UN À RELIER ═══
   *
   * Un menu vide à chaque création — le cas courant de tout parc qu'on reprend
   * en main, où personne n'a encore de compte — serait un champ qui ne mène
   * nulle part, sur la modale la plus utilisée de l'écran.
   *
   * Et il ne propose QUE des membres SANS fiche : proposer quelqu'un de déjà
   * relié offrirait un geste que le serveur refuse par `account_already_linked`.
   * On ne propose pas ce qu'on refusera — la règle que cet écran applique déjà
   * au code de gestionnaire.
   */
  const [compte, setCompte] = useState('')
  const [reliables, setReliables] = useState<MembreReliable[]>([])

  useEffect(() => {
    /* La démonstration sert son propre registre, comme l'écran des accès. Son
       locataire y est DÉJÀ relié — c'est le cas nominal qu'elle montre —, donc
       la liste y est vide et le champ ne paraît pas. Rien à mesurer de plus. */
    if (estDemo) {
      setReliables(membresReliables(ACCES_DEMO.members))
      return
    }
    if (!parkId) return
    let vivant = true
    void api
      .access<{ members: MembreReliable[] }>(parkId)
      .then((registre) => {
        if (vivant) setReliables(membresReliables(registre.members))
      })
      /* SILENCIEUX, ET C'EST LA BONNE DÉGRADATION. Ce champ est un RACCOURCI :
         le geste existe aussi sur « Accès au parc », qui dit lui-même quand son
         registre est illisible. Poser une erreur ici interromprait la création
         d'une fiche pour une commodité qu'on ne peut pas offrir. */
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [parkId, estDemo])
  /**
   * L'INDICATIF PROPOSÉ EST CELUI DU PARC.
   *
   * Le champ était d'abord un `tel` nu, sans indicatif, alors que l'inscription
   * en pose un : un bailleur hors zone CFA créait une fiche dont le numéro ne
   * permettait pas d'envoyer le code promis par le libellé d'aide. L'indicatif
   * est arrivé — et il est arrivé ÉCRIT EN DUR, `'+237'`, ce qui déplaçait le
   * défaut au lieu de le fermer : un parc ivoirien, sénégalais ou français
   * proposait toujours le Cameroun, et le numéro composé à partir de là
   * n'appelle personne.
   *
   * Le pays du parc voyage DÉJÀ sur l'adhésion, avec son propre cas. Rien
   * n'était à transporter : seulement à lire.
   *
   * LE REPLI RESTE `+237`, et ce n'est pas de la paresse. `countryCode` est
   * facultatif — un serveur antérieur au champ ne le rend pas —, et ouvrir sur
   * un champ VIDE obligerait alors à choisir un pays à chaque fiche, dans celui
   * où le produit est effectivement utilisé.
   *
   * Il reste MODIFIABLE : un bailleur camerounais peut avoir un locataire
   * joignable sur un numéro français. Le champ propose, il n'impose pas.
   */
  const [dial, setDial] = useState(
    () => INDICATIFS[adhesionActive?.countryCode ?? ''] ?? '+237',
  )
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
      // Sans ce relais, la fiche naîtrait orpheline malgré le choix fait à
      // l'écran — exactement le défaut que ce champ existe pour supprimer.
      ...(compte ? { userId: compte } : {}),
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
              {/* Resserré comme à l'inscription, et pour la même mesure : le
                  libellé « Congo-Brazzaville · +242 » rognait son indicatif
                  dans 176 px. Fermé, le champ porte l'indicatif ; la liste
                  porte les pays. Voir `OptionCombobox.resume`. */}
              <div className="w-26 shrink-0">
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
                    resume: code,
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

        {/*
          LE COURRIEL, FACULTATIF — et ce qu'il DÉBLOQUE justifie sa place ici.

          Le serveur écrit déjà au locataire SANS compte, par
          `reportedByTenant.user?.email ?? reportedByTenant.email`. Ce repli n'a
          jamais servi : rien ne collectait l'adresse de la fiche. C'est ce que la
          bannière de cet écran annonce — « il ne reçoit aucune annonce ».

          FACULTATIF comme la date de début : l'exiger fermerait la saisie d'un
          locataire déjà en place dont on n'a que le téléphone.
        */}
        <Field label={t('app.tenants.email')} hint={t('app.tenants.emailHint')} optional>
          {(props) => (
            <Input
              id={props.id}
              aria-describedby={props['aria-describedby']}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
            />
          )}
        </Field>

        {reliables.length > 0 && (
          <Field label={t('app.tenants.account')} hint={t('app.tenants.accountHint')} optional>
            {(props) => (
              <Select
                {...props}
                name="userId"
                value={compte}
                onChange={(e) => setCompte(e.target.value)}
              >
                {/* L'ABSENCE EST LE DÉFAUT, et elle est nommée. Un menu qui
                    s'ouvre sur le premier compte relierait la fiche à
                    quelqu'un qu'on n'a pas choisi — sur ce champ-ci, c'est
                    donner le bail, les quittances et les relevés d'un
                    locataire à un autre. */}
                <option value="">{t('app.tenants.accountNone')}</option>
                {reliables.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {`${m.fullName} — ${m.email}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

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
