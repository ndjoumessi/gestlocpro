import { useEffect, useRef, useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { PageHeader } from '@/components/layout/PageHeader'
import { InviteModal } from './InviteModal'
import { AnnounceModal } from './AnnounceModal'
import { Notice } from '@/components/primitives/Notice'
import { Card, CardHeader } from '@/components/primitives/Card'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import {
  PaymentStatusPill,
  StatusPill,
  type PaymentStatus,
} from '@/components/primitives/StatusPill'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Combobox } from '@/components/primitives/Combobox'
import { StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { GroupeDeFiltres } from '@/components/controls/GroupeDeFiltres'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { AU_DELA_LG, useAuDela } from '@/lib/useAuDela'
import { initiales } from './initiales'
import { useTriDansLAdresse } from '@/lib/useTriDansLAdresse'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useI18n, useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { dialOptions } from '@/lib/countries'
import { INDICATIFS } from '@/lib/indicatifs'
import { telephoneLisible } from '@/lib/telephone'
import { useSession } from '@/api/SessionProvider'
import { api } from '@/api/client'
import {
  ACCES_DEMO,
  DOCUMENT_KIND_LABELS,
  buildingById,
  receiptDue,
  type Unit,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { validateName, validatePhone, type FieldError } from '@/features/auth/validation'

/*
  LA GRILLE DES FICHES DE LOCATAIRE — fluide, jamais plus large que sa boîte.

  Autant de colonnes de 18 rem qu'il en tient. Mesuré à 1280 px : vingt rem ne
  donnaient que DEUX colonnes dans les 950 px du contenu, là où dix-huit en
  donnent trois de 308 px — assez pour les deux colonnes de couples nom/valeur
  que la fiche porte, « 1 397 000 FCFA » compris. À 320 px, une colonne pleine
  largeur.

  Nommée, et non écrite deux fois : le squelette rend la MÊME grille, faute de
  quoi la page se réorganise à l'arrivée des données.
*/
/*
  L'ORDRE DES ÉTATS DANS LE FILTRE, ET IL N'EST PAS ALPHABÉTIQUE.

  Du plus urgent au plus calme : en retard, partiel, non appelé, en attente, à
  jour. Un bailleur ouvre cet écran pour ce qui cloche ; la première pastille
  après « Tous » doit être celle qu'il vient chercher.

  LES OPTIONS SE DÉRIVENT DES ÉTATS PRÉSENTS, jamais d'une liste figée. Une
  liste figée offre des filtres qui ne rendent rien — et, plus grave, elle en
  OMET : un locataire dont l'état n'est dans aucune option resterait
  inatteignable dès qu'on filtre. Ici, tout état porté par au moins un bail a
  sa pastille, et aucune pastille ne mène au vide.
*/
const ETATS_DU_FILTRE: PaymentStatus[] = ['overdue', 'partial', 'uncalled', 'pending', 'paid']

const GRILLE_DES_FICHES_DE_LOCATAIRE =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3'

/**
 * LES QUATRE SECTIONS D'UNE FICHE S'ALIGNENT SUR CELLES DE SES VOISINES.
 *
 * Chaque fiche occupe quatre rangées de la grille — identité, états, faits,
 * gestes — et les partage par `subgrid` avec les fiches de la même ligne.
 * « Loyer » tombe donc à la même hauteur partout. Sans cela, relevé le
 * 2026-09-11 : les fiches qui portent « Sans compte » descendaient leur grille
 * de 38 px sous celle de leurs voisines, et la comparaison « d'un coup d'œil »
 * que promet la grille des faits ne se faisait plus. Un nom sur deux lignes
 * aurait produit le même décalage.
 *
 * Posé sur l'élément de liste ET sur la carte : la carte est l'enfant de
 * l'élément, et une rangée ne se transmet qu'à travers chaque niveau.
 */
const SECTIONS_DE_FICHE = 'row-span-4 grid grid-rows-subgrid'

/**
 * UN COUPLE NOM/VALEUR de la fiche, et il est un vrai couple.
 *
 * `<dt>`/`<dd>` et non deux paragraphes : un lecteur d'écran annonce le terme
 * avant sa définition, là où une mise en page le laisserait deviner. C'est la
 * règle que `DataTable` applique déjà dans ses fiches mobiles.
 */
function FaitDeLaFiche({
  libelle,
  children,
}: {
  libelle: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-muted">{libelle}</dt>
      <dd className="numeric mt-0.5 truncate text-body">{children}</dd>
    </div>
  )
}

export function Tenants() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const [open, setOpen] = useState(false)
  const [inviteOuverte, setInviteOuverte] = useState(false)
  const [annonceOuverte, setAnnonceOuverte] = useState(false)

  // Unités partagées : rattacher un locataire doit se voir ici, dans le parc
  // immobilier et dans le taux d'occupation du tableau de bord.
  const { units, loading, removeTenant, documentRequests, resolveDocumentRequest, unitById } =
    usePortfolio()
  /* TOUT CECI EST DÉJÀ CHARGÉ AVEC LE PARC, et la fiche le dit sans une requête
     de plus : la caution consignée, les travaux ouverts du logement, et les
     échéances du bail dont se déduit le solde cumulé. Le tableau les taisait —
     six colonnes, et le bailleur allait les chercher sur trois autres écrans. */
  const { deposits, worksForUnit, receiptsForUnit, remindRent } = usePortfolio()
  /* LE MÊME SEUIL QUE LA BASCULE EN FICHES : au-dessus, un tableau, ses cartes
     et sa file de demandes ; en dessous, la liste d'abord. Un seul seuil pour
     toute la page, comme sur l'écran du parc.

     AVEC LES AUTRES CROCHETS, ET AVANT `if (loading)`. Posé plus bas, il ne
     s'appelait pas au premier rendu — « Rendered more hooks than during the
     previous render », et cinq cas rouges d'un coup. C'est le même défaut que
     l'écran de connexion a déjà payé, et il se reprend au même endroit : un
     retour anticipé ne se franchit qu'une fois tous les crochets posés. */
  const enTableau = useAuDela(AU_DELA_LG)
  const [aCorriger, setACorriger] = useState<Unit | null>(null)
  /* Le logement vacant qu'on vient d'ouvrir à l'attribution — même état que
     sur l'écran du parc, et la même modale au bout. */
  const [aAttribuer, setAAttribuer] = useState<Unit | null>(null)
  const [aRetirer, setARetirer] = useState<Unit | null>(null)
  /* Le locataire qu'on relance depuis SA fiche. La relance part vers une
     personne : elle se confirme, comme celle des paiements. */
  const [aRelancer, setARelancer] = useState<Unit | null>(null)
  const [relanceEnCours, setRelanceEnCours] = useState(false)
  const { role } = useRole()
  const base = useBase()
  const { notify } = useToast()

  const leases = units.filter((unit) => unit.tenant !== null)

  /*
    CHERCHER ET FILTRER, sur un écran qui ne le permettait pas.

    Dix fiches tiennent à l'œil ; cinquante non, et un parc réel en porte
    cinquante. L'écran offrait alors de faire défiler, et rien d'autre — pas
    même le geste que le parc immobilier a depuis toujours. Nelson l'a demandé
    le 2026-09-07.

    LA RECHERCHE PORTE SUR CE QU'ON RETIENT D'UNE PERSONNE : son nom, son
    logement, son numéro. Le numéro compte autant que le nom sur ce marché —
    c'est par lui qu'on retrouve quelqu'un dont on ne sait plus l'orthographe.

    LES DEUX SE COMBINENT, et c'est le point : « en retard » puis « Akwa »
    répond à la question qu'on se pose vraiment.
  */
  /* LA RECHERCHE RESTE LOCALE, et c'est une décision, pas un oubli : « une
     frappe en cours de saisie est éphémère », dit le mois du parc, et une
     adresse réécrite à chaque caractère n'est pas une vue partageable. L'ÉTAT,
     lui, désigne une vue stable — « regarde les trois en retard » — donc il va
     dans l'adresse. */
  const [recherche, setRecherche] = useState('')
  const [filtreDEtat, setFiltreDEtat] = useTriDansLAdresse<PaymentStatus | 'all'>(
    'etat',
    'all',
    ETATS_DU_FILTRE.filter((etat) => leases.some((unit) => unit.status === etat)),
  )
  const aiguille = recherche.trim().toLowerCase()
  const visibles = leases.filter((unit) => {
    if (filtreDEtat !== 'all' && unit.status !== filtreDEtat) return false
    if (!aiguille) return true
    /* Le libellé du logement et non son identifiant : c'est « A1 » qu'on lit à
       l'écran et qu'on retape, pas l'uuid que servira l'API. */
    /* Le numéro BRUT et le numéro LU : on tape ce qu'on voit à l'écran
       (« 77 00 00 »), ou ce qu'on a dans son répertoire (« 677000000 »). */
    return [
      unit.tenant ?? '',
      unit.label,
      unit.phone ?? '',
      unit.phone ? telephoneLisible(unit.phone) : '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(aiguille)
  })
  const effacerLesFiltres = () => {
    setRecherche('')
    setFiltreDEtat('all')
  }
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

  /**
   * LA CARTE DES DEMANDES, NOMMÉE UNE FOIS ET RENDUE À UN SEUL ENDROIT.
   *
   * Elle vivait avant la liste. Mesuré à 375 px : le premier locataire
   * apparaissait à 1 223 px — UN ÉCRAN ET DEMI de préambule sur l'écran dont le
   * geste est « trouver quelqu'un » — et cette carte en portait 204.
   *
   * Une file de pièces à fournir est la CORVÉE du propriétaire, pas la question
   * de cet écran. Sur un téléphone elle passe donc DERRIÈRE la liste : elle ne
   * perd rien, ni son contenu ni ses deux gestes, elle change de rang.
   *
   * AU-DESSUS DE `lg` ELLE NE BOUGE PAS : le tableau y tient en deux écrans et
   * la carte ne coûte qu'une rangée. Déplacer un bloc là où il ne gêne personne,
   * ce serait déplacer un défaut qui n'existe pas.
   *
   * RENDUE À UN SEUL ENDROIT à la fois, jamais montée deux fois puis cachée :
   * `fichesDuTableau` refuse la donnée en double, « un utilitaire responsif
   * cache, il ne retire pas — la donnée restait deux fois dans le document,
   * donc deux fois dans les octets envoyés et deux fois pour un lecteur
   * d'écran ».
   */
  const carteDesDemandes =
    demandesEnAttente.length > 0 ? (
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
                <p className="mt-0.5 text-label text-muted">
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
    ) : null

  /*
    LES LOCATAIRES EN FICHES, SUR BUREAU — une par personne.

    Le tableau portait six colonnes de même poids et une identité noyée dedans :
    pour savoir ce qu'un locataire doit, ce qu'on tient de lui et ce qui traîne
    sur son logement, il fallait ouvrir Paiements, Cautions et Travaux. Nelson a
    montré une référence le 2026-09-07 — une fiche par locataire, l'état en
    tête, quatre faits en grille, les gestes en bas — et la forme la suit.

    Sous `lg`, rien ne change : `DataTable` rend déjà des fiches.

    CE QUE LA RÉFÉRENCE MONTRE ET QUE LE PRODUIT NE SAIT PAS DIRE, laissé vide
    plutôt qu'inventé : le bail signé en PDF (aucun document de bail n'existe),
    l'historique par personne (le dossier du logement en tient lieu), et la fin
    de bail — `endsOn` vit au schéma, le portefeuille ne l'envoie pas, donc
    aucun « part le 10/08 » ne peut être vrai ici.
  */
  const fichesDesLocataires = (
    <ul
      aria-label={t('app.tenants.title')}
      className={GRILLE_DES_FICHES_DE_LOCATAIRE}
      /* DÉCLARÉE à `mesure-ui` : ses fiches voisines doivent commencer chaque
         section à la même hauteur — voir `MESURER_SECTIONS_ALIGNEES`. */
      data-mesure="sections-alignees"
    >
      {visibles.map((unit) => {
        const caution = deposits.find((c) => c.unitId === unit.id && c.status === 'held')
        const chantiers = worksForUnit(unit.id).filter((w) => w.status !== 'done').length
        /* LE SOLDE CUMULÉ, comme sur Paiements et par le même calcul : ce qui
           reste dû sur TOUTES les périodes du bail, et non l'écart du mois.
           « Paul doit 258 000 » ne dit pas la même démarche que « Paul doit le
           mois de septembre ». Sans historique — un parc dont aucune échéance
           n'est enregistrée — on retombe sur l'écart du mois, seule chose qu'on
           sache alors. Négatif quand il a payé d'avance. */
        const recus = receiptsForUnit(unit.id)
        const solde =
          recus.length > 0
            ? recus.reduce((somme, r) => somme + receiptDue(r) - r.paidMinor, 0)
            : unit.rent - unit.paid
        const enRetard = unit.status === 'overdue' || unit.status === 'partial'
        return (
          <li key={unit.id} data-fiche-locataire="" className={SECTIONS_DE_FICHE}>
            <Card as="article" className={SECTIONS_DE_FICHE}>
              {/* L'IDENTITÉ, EN UN SEUL BLOC : le nom, le logement, le numéro.

                  Trois lignes d'une même personne se lisaient comme trois
                  sections, séparées par l'écart des blocs. Elles forment
                  désormais une colonne serrée à droite de l'avatar — la même
                  largeur que leur ancien `pl-12`, qui leur avait été donné
                  quand la pastille partageait encore leur rangée.

                  LE NOM N'EST PLUS COUPÉ. Il se coupait « au survol » à côté de
                  la pastille : relevé sur un parc réel, « DJOUMESSI MAR… ».
                  Sur une fiche de personne, c'est la dernière chose à rogner,
                  et le survol n'est pas une manière de lire. Il se replie. */}
              <div data-section="identite" className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-semibold text-muted"
                >
                  {initiales(unit.tenant)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="font-medium break-words">{unit.tenant}</p>
                  {/* LE LOGEMENT ET LA DATE D'ENTRÉE. Le QUARTIER est parti
                      d'ici : en anglais à 1280 px, « A1 · Bonamoussadi · since
                      August 2023 » se coupait sur les dix fiches, et le
                      quartier situe un IMMEUBLE — il ne dit rien d'une
                      personne, et vit déjà sur l'écran du parc. */}
                  <p className="numeric truncate text-label text-muted">
                    {unit.label}
                    {unit.leaseStart
                      ? ` · ${t('app.portfolio.sinceLease', { date: d.monthYearInline(unit.leaseStart) })}`
                      : ''}
                  </p>
                  {/* LE NUMÉRO, PARCE QUE C'EST PAR LÀ QUE ÇA SE RÈGLE. Sur le
                      marché visé, appeler EST la démarche — avant la relance
                      écrite, après elle, et pour tout ce qui n'est pas un
                      impayé. `min-h-11` : un lien qu'un pouce vise est une
                      cible, et le produit tient 44 px partout ; `-my-2` rend
                      à la colonne l'interligne que la cible déborde. */}
                  {unit.phone ? (
                    <a
                      href={`tel:${unit.phone.replace(/\s/g, '')}`}
                      className="numeric -my-2 inline-flex min-h-11 items-center self-start text-label text-muted no-underline hover:text-ink hover:underline"
                    >
                      {telephoneLisible(unit.phone)}
                    </a>
                  ) : null}
                </div>
              </div>

              {/* LES ÉTATS DE LA PERSONNE, ENSEMBLE ET SOUS SON NOM.

                  La pastille de paiement partageait la rangée du nom, et
                  chacun cédait à l'autre : le nom se coupait, « En retard » se
                  pliait sur deux lignes. Elle rejoint « Sans compte », qui
                  vivait déjà là — un état de la PERSONNE, pas un de ses quatre
                  chiffres. La rangée existe sur TOUTES les fiches, puisque
                  l'état de paiement y est toujours : c'est ce qui la rend
                  alignable. */}
              {/* LE MENU AU BOUT DES ÉTATS — le coin haut-droit de la fiche, sous
                  l'identité.

                  Il fermait la rangée des gestes, et à 1536 px, où une fiche fait
                  295 px, « Relancer », « Dossier » et lui n'y tenaient plus : il
                  partait SEUL à la ligne suivante. Ici, il a la place — deux
                  pastilles courtes — et la rangée des gestes n'a plus que deux
                  boutons, qui tiennent dans la fiche la plus étroite.

                  `-my-[11px]` : le rond fait 44 px, la pastille 22,8. Sans marge
                  négative, la rangée grandirait de 21 px sur TOUTES les fiches
                  d'une ligne — `subgrid` partage sa hauteur. 11 px et non 10 : à
                  10, le rond occupait 24 px, un de plus que la pastille, et
                  `plafond-hauteurs` a compté les 5 px des quatre rangées de
                  fiches. À 11, il en occupe 22 et la rangée garde sa hauteur ; il
                  déborde dans les 12 px d'écart qui l'entourent, sans y toucher. */}
              <div data-section="etats" className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <PaymentStatusPill status={unit.status} size="sm" />
                  {unit.tenantHasAccount === false && (
                    <StatusPill tone="warn" size="sm">
                      {t('app.tenants.noAccount')}
                    </StatusPill>
                  )}
                </div>
                {unit.tenant && unit.tenantId ? (
                  <MenuDeDebordement
                    libelle={t('app.tenants.actionsFor', { name: unit.tenant })}
                    className="-my-[11px]"
                  >
                    <MenuElement
                      icone="sliders"
                      onClick={() => setACorriger(unit)}
                      nomAccessible={t('app.tenants.editFor', { name: unit.tenant })}
                    >
                      {t('app.tenants.edit')}
                    </MenuElement>
                    {/* Le serveur refuse de toute façon tant qu'une somme a
                        circulé ; ce masquage évite d'offrir un geste à qui n'y
                        a pas droit, il ne remplace pas la règle. */}
                    <MenuElement
                      icone="close"
                      onClick={role === 'owner' ? () => setARetirer(unit) : undefined}
                      nomAccessible={
                        role === 'owner'
                          ? t('app.tenants.removeFor', { name: unit.tenant })
                          : t('app.tenants.removeBlocked')
                      }
                    >
                      {t('app.tenants.remove')}
                    </MenuElement>
                  </MenuDeDebordement>
                ) : null}
              </div>

              {/* QUATRE FAITS, TOUJOURS LES MÊMES ET TOUJOURS LÀ. Une grille dont
                  les cases changent d'une fiche à l'autre ne se compare plus
                  d'un coup d'œil ; une case sans valeur porte un tiret. */}
              <dl
                data-section="faits"
                className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-divider pt-3"
              >
                <FaitDeLaFiche libelle={t('app.portfolio.rent')}>
                  {money(unit.rent, { compact: true })}
                </FaitDeLaFiche>
                <FaitDeLaFiche libelle={t('app.tenants.cardDeposit')}>
                  {caution ? (
                    money(caution.held, { compact: true })
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </FaitDeLaFiche>
                <FaitDeLaFiche libelle={t('app.payments.balanceTotal')}>
                  {solde === 0 ? (
                    <span className="text-muted">{money(0, { compact: true })}</span>
                  ) : (
                    /* Une AVANCE n'est pas une dette : elle se lit en clair,
                       avec son signe, et jamais en rouge. Même règle que la
                       colonne de solde des paiements. */
                    <span className={solde > 0 ? 'font-medium text-danger' : 'text-ok'}>
                      {solde > 0 ? '−' : '+'}
                      {money(Math.abs(solde), { compact: true })}
                    </span>
                  )}
                </FaitDeLaFiche>
                <FaitDeLaFiche libelle={t('app.tenants.cardWorks')}>
                  {chantiers > 0 ? (
                    String(chantiers)
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </FaitDeLaFiche>
              </dl>

              {/* LES GESTES COMMENCENT EN HAUT DE LEUR RANGÉE, comme les trois
                  sections au-dessus, et leur filet avec eux.

                  Ils se posaient au BAS (`self-end`, héritier de `mt-auto`). Tant
                  qu'ils tenaient sur une ligne, c'était pareil. À 1536 px, une
                  fiche fait 295 px : « Relancer », « Dossier » et le menu n'y
                  tenaient plus, le menu passait à la ligne, et la rangée des
                  gestes grandissait de 52 px. Calés en bas, les gestes des fiches
                  sans relance faisaient descendre leur filet de 52 px sous celui
                  de leur voisine — `MESURER_SECTIONS_ALIGNEES` l'a trouvé en
                  naissant. Calés en haut, le filet reste une ligne. Le menu, lui,
                  est parti au bout de la rangée des états : il ne reste ici que
                  deux boutons, qui tiennent dans la fiche la plus étroite. */}
              <div
                data-section="gestes"
                className="flex flex-wrap content-start items-center gap-2 border-t border-divider pt-3"
              >
                {/* LE GESTE QUE L'ÉTAT APPELLE, et lui seul. Relancer n'a de sens
                    que sur un impayé ou un partiel ; l'offrir partout ferait
                    dix boutons dont huit n'ont rien à envoyer. */}
                {enRetard && (
                  <Button
                    size="sm"
                    icon="bell"
                    aria-label={t('app.tenants.remindFor', { name: unit.tenant ?? '' })}
                    onClick={() => setARelancer(unit)}
                  >
                    {t('app.tenants.remindOne')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  icon="file"
                  to={lien(base, `parc/${unit.id}`)}
                >
                  {t('app.tenants.fileLink')}
                </Button>
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )


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

      {/* LES TROIS CARTES NE PARAISSENT QU'AU-DESSUS DE `lg`.

          421 px empilés à 375 px, et deux d'entre elles REDISENT le tableau de
          bord : « Loyers attendus 1 397 000 FCFA · 10 baux actifs » et « Taux
          d'occupation 83 % · 2 unités vacantes » y sont déjà, relevés le
          2026-09-06. Les cartes d'ici disent « Baux actifs 10 · 2 logements
          vacants » et « Loyer mensuel 1 397 000 FCFA » : les mêmes nombres, à un
          clic.

          La troisième — « Pièces demandées 1 » — chapeaute la carte qui la SUIT
          et qui liste cette pièce avec son titre, son locataire et sa date. Un
          compte au-dessus de la liste qu'il compte.

          Au-dessus de `lg`, la grille a trois colonnes : la rangée coûte une
          hauteur de carte, et les trois se lisent d'un regard. */}
      {enTableau && (
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
      )}

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
      {enTableau && carteDesDemandes}

      {/* LA BARRE NE PARAÎT QUE S'IL Y A QUELQUE CHOSE À TRIER. Sur un parc
          sans bail, une recherche et cinq pastilles à zéro occuperaient la
          place du seul geste utile — créer une fiche —, et laisseraient croire
          qu'il y a quelque chose à trouver. */}
      {leases.length > 0 && (
        <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <div className="w-full max-w-xs">
            {/* Le nom accessible garde la phrase entière, le gabarit
                raccourcit : à 320 px le champ n'offre que 228 px, et un
                gabarit tronqué ne déborde de rien. Même arbitrage que la
                recherche du parc, et pour la même mesure. */}
            <Input
              icon="search"
              type="search"
              aria-label={t('app.tenants.searchLabel')}
              placeholder={t('app.tenants.searchShort')}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <GroupeDeFiltres
            libelle={t('app.tenants.rentStatus')}
            valeur={filtreDEtat}
            onChange={setFiltreDEtat}
            options={[
              {
                valeur: 'all' as PaymentStatus | 'all',
                libelle: t('app.payments.filterAll'),
                compte: leases.length,
              },
              ...ETATS_DU_FILTRE.filter((etat) =>
                leases.some((unit) => unit.status === etat),
              ).map((etat) => ({
                valeur: etat as PaymentStatus | 'all',
                libelle: t(`status.${etat}` as 'status.paid'),
                compte: leases.filter((unit) => unit.status === etat).length,
              })),
            ]}
          />
        </div>
      )}

      {/* CE QUE LE FILTRE NE REND PAS, ET LE GESTE POUR EN SORTIR. Une grille
          vide sans un mot laisse croire que le parc l'est ; le bouton efface
          les deux filtres à la fois, puisque c'est leur combinaison qui a pu
          tout écarter. */}
      {leases.length > 0 && visibles.length === 0 ? (
        <EmptyState
          level={2}
          icon="users"
          title={t('app.tenants.searchEmpty')}
          body={t('app.tenants.searchEmptyHint')}
          action={
            <Button variant="secondary" onClick={effacerLesFiltres}>
              {t('app.tenants.resetFilters')}
            </Button>
          }
        />
      ) : enTableau && visibles.length > 0 ? (
        fichesDesLocataires
      ) : (
      <DataTable<Unit>
        caption={t('app.tenants.title')}
        rows={visibles}
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
                <span className="ml-2 text-label text-muted">
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
                  {/* Groupé comme sur la fiche de bureau : deux formes d'un
                      même écran n'écrivent pas un numéro de deux façons. */}
                  {telephoneLisible(unit.phone)}
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
                /* `flex-wrap` : TROIS gestes ne tiennent pas sur une ligne de
                   320 px. Mesuré par `mesure-ui` à l'anglais — « Send reminder ·
                   Correct · Remove » sortait de sa boîte de 65 px, sur 24
                   occurrences, sans faire défiler la page ni rougir aucune autre
                   règle. La rangée se replie comme celle qui la contient. */
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {/* LA RELANCE EXISTE DES DEUX CÔTÉS DU SEUIL. Elle est née sur
                      la fiche de bureau ; l'oublier ici aurait donné un geste
                      qui disparaît en tournant le téléphone — et une modale que
                      `modales.mjs` ne peut ouvrir qu'à une largeur sur deux,
                      c'est-à-dire à moitié mesurée. */}
                  {/* LE MÊME NOM ACCESSIBLE DES DEUX CÔTÉS DU SEUIL, et c'est
                      `modales.mjs` qui l'a exigé : le menu de la fiche de bureau
                      dit « Corriger la fiche de Charles Ngassa », le bouton
                      mobile disait « Corriger ». Deux noms pour un geste, donc
                      une garde qui ne peut viser qu'une des deux formes — et,
                      pour qui écoute, dix boutons « Corriger » qui ne disent pas
                      lequel on active. */}
                  {(unit.status === 'overdue' || unit.status === 'partial') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="bell"
                      aria-label={t('app.tenants.remindFor', { name: unit.tenant })}
                      onClick={() => setARelancer(unit)}
                    >
                      {t('app.tenants.remindOne')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="sliders"
                    aria-label={t('app.tenants.editFor', { name: unit.tenant })}
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
                      aria-label={t('app.tenants.removeFor', { name: unit.tenant })}
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
      )}

      {!enTableau && <div className="mt-6">{carteDesDemandes}</div>}

      {/* Le deux-points était concaténé dans le JSX, précédé d'une espace :
          une règle typographique française servie telle quelle en anglais.
          Il vit maintenant dans la clé, avec la conjonction de la liste. */}
      {/*
        LA RELANCE SE CONFIRME, parce qu'elle SORT — un message part vers une
        personne, et rien ne le rappelle. Mêmes mots que la relance groupée des
        paiements, au singulier : la trace datée, et le locataire déjà relancé
        aujourd'hui qui sera ignoré.
      */}
      {aRelancer && (
        <Modal
          open
          onClose={() => setARelancer(null)}
          size="sm"
          title={t('app.payments.remindTitle', { count: 1 })}
          description={t('app.payments.remindBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setARelancer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                loading={relanceEnCours}
                onClick={async () => {
                  if (relanceEnCours) return
                  setRelanceEnCours(true)
                  /* `leaseId` quand il existe, `id` en démonstration : c'est le
                     fournisseur qui court-circuite là-bas, faute de parc
                     serveur. Même lecture que la relance groupée. */
                  const bilan = await remindRent([aRelancer.leaseId ?? aRelancer.id])
                  setRelanceEnCours(false)
                  setARelancer(null)
                  /* Le message dit ce qui A EU LIEU, pas ce qui a été demandé :
                     un bail relancé le matin même est ignoré par le serveur.

                     ET « IGNORÉ » N'EST PAS « RATÉ ». Ce second appelant portait
                     le même défaut que la relance groupée, et c'est le TYPE qui
                     l'a trouvé : sur une panne réseau il annonçait « déjà
                     relancé aujourd'hui » — la règle du serveur, invoquée sans
                     que le serveur ait répondu. */
                  if (bilan.issue === 'echec') return
                  if (bilan.issue === 'demonstration') {
                    notify(t('app.payments.remindDemo'), { tone: 'neutral' })
                    return
                  }
                  notify(
                    bilan.envoyees > 0
                      ? t('app.payments.remindDone', { count: bilan.envoyees })
                      : t('app.payments.remindSkipped', { count: bilan.ecartees }),
                    /* `neutral` et non un ton d'alerte : « déjà relancé aujourd'hui »
                       n'est pas un échec, c'est la règle du serveur — et
                       maintenant c'est bien lui qui l'a dite. */
                    { tone: bilan.envoyees > 0 ? 'ok' : 'neutral' },
                  )
                }}
              >
                {t('app.tenants.remindOne')}
              </Button>
            </>
          }
        >
          <p className="text-body text-muted">{aRelancer.tenant}</p>
        </Modal>
      )}
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

      {/*
        LES LOGEMENTS VACANTS PORTENT LEUR GESTE, ET C'EST TOUT LE LOT.

        CE QU'IL Y AVAIT AVANT : « 3 unités vacantes : A3, B2 et A1 » — une
        phrase grise, en bas de page, sous le vide laissé par deux fiches dans
        une grille qui en tient six. Ces trois logements sont pourtant ce que
        l'écran a de plus coûteux : aucun loyer n'y est appelé, et le seul
        endroit du produit où l'on pouvait y remédier était l'écran du PARC.

        La phrase nommait le problème et n'offrait rien. Elle devient des fiches,
        dans la MÊME grille que les locataires en place, avec le MÊME geste
        qu'au parc — `app.portfolio.assignTenant`, la clé elle-même, pour que le
        nom accessible soit identique des deux côtés. C'est la règle que ce
        dépôt a payée : un geste vit sous un seul nom, où qu'il se trouve.

        LA MODALE EST DÉJÀ LÀ. `NewTenantModal` est montée par cet écran depuis
        toujours, et le parc l'ouvre déjà pré-remplie sur une unité. Rien de
        neuf n'est inventé : un chemin manquait.
      */}
      {vacant.length > 0 && (
        <Card flush className="mt-6">
          <CardHeader
            level={2}
            title={t('app.tenants.vacantTitle', { count: vacant.length })}
            description={t('app.tenants.vacantHint')}
          />
          <ul aria-label={t('app.tenants.vacantTitle', { count: vacant.length })} className={`${GRILLE_DES_FICHES_DE_LOCATAIRE} px-4 pb-4`}>
            {vacant.map((unit) => (
              <li key={unit.id}>
                <Card className="flex h-full flex-col gap-2">
                  <p className="numeric font-medium">{unit.label}</p>
                  <p className="text-label text-muted">
                    {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
                  </p>
                  {/* LE LOYER ATTENDU, et non un tiret : c'est le montant que ce
                      logement vide ne rapporte pas. Même formulation qu'au parc. */}
                  <p className="numeric text-body">
                    {money(unit.rent, { compact: true })}
                    <span className="ml-1 text-muted">{t('app.portfolio.rentExpected')}</span>
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="users"
                    onClick={() => setAAttribuer(unit)}
                    className="mt-auto self-start"
                  >
                    {t('app.portfolio.assignTenant')}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {aAttribuer && (
        <NewTenantModal vacant={[aAttribuer]} onClose={() => setAAttribuer(null)} />
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
        {/* Deux formes, comme l'écran chargé : les fiches de `SkeletonTable`
            sous `lg`, la grille de fiches de locataire au-delà. Un squelette de
            tableau annoncerait une forme qui ne vient plus. */}
        <div className="lg:hidden">
          <SkeletonTable fiches />
        </div>
        <div aria-hidden="true" className={`hidden lg:grid ${GRILLE_DES_FICHES_DE_LOCATAIRE}`}>
          {[0, 1, 2, 3, 4, 5].map((fiche) => (
            <Card key={fiche} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Skeleton radius="full" className="size-9" />
                <div className="min-w-0 flex-1">
                  <Skeleton line="body" className="w-3/5" />
                  <Skeleton line="eyebrow" className="mt-1 w-4/5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-divider pt-3">
                {[0, 1, 2, 3].map((fait) => (
                  <div key={fait}>
                    <Skeleton line="eyebrow" className="w-16" />
                    <Skeleton line="body" className="mt-0.5 w-20" />
                  </div>
                ))}
              </div>
              <div className="border-t border-divider pt-3">
                <Skeleton radius="md" className="h-9 w-28" />
              </div>
            </Card>
          ))}
        </div>
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

export function NewTenantModal({ vacant, onClose }: { vacant: Unit[]; onClose: () => void }) {
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
              <Combobox
                id={props.id}
                aria-describedby={props['aria-describedby']}
                invalid={props['aria-invalid']}
                name="userId"
                autoComplete="off"
                value={compte}
                onChange={setCompte}
                /* Dans une modale : la liste ne se déplie pas parce que le
                   dialogue vient de donner le focus. Voir `ouvrirAuFocus`. */
                ouvrirAuFocus={false}
                /* LES COMPTES AUSSI GRANDISSENT AVEC LE PARC, et le libellé
                   porte le courriel : c'est par lui qu'on distingue deux
                   homonymes, donc c'est par lui qu'on doit pouvoir chercher.

                   ET C'EST POURQUOI CE CHAMP REFUSE LE REMPLISSAGE. Un menu
                   déroulant ne se mémorise pas ; ce champ-ci est une zone de
                   saisie, dont la valeur VISIBLE porte « Nom Complet
                   — courriel ». (La balise ne s'écrit pas ici : la garde
                   `saisieNumeriqueParLaPrimitive` balaye la SOURCE et ne
                   distingue pas un commentaire d'un rendu — elle a rougi sur
                   cette prose.) Sans
                   jeton, l'historique de formulaire ou un gestionnaire tiers
                   peut la retenir et la proposer à la personne suivante sur un
                   poste partagé de cabinet — le marché de ce produit. Voir
                   `scripts/check-remplissage.mjs`, qui l'exige des treize
                   champs cherchables.

                   L'ABSENCE EST LE DÉFAUT, et elle est nommée. Un menu qui
                   s'ouvre sur le premier compte relierait la fiche à quelqu'un
                   qu'on n'a pas choisi — sur ce champ-ci, c'est donner le bail,
                   les quittances et les relevés d'un locataire à un autre. Elle
                   reste donc une entrée à part entière, en tête, plutôt qu'un
                   champ vide qu'on lirait comme « pas encore répondu ». */
                options={[
                  { value: '', label: t('app.tenants.accountNone') },
                  ...reliables.map((m) => ({
                    value: m.userId,
                    label: `${m.fullName} — ${m.email}`,
                  })),
                ]}
              />
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

        {/* Une liste qui grandit avec le parc se FILTRE — motif détaillé dans
            `RecordPaymentModal`. La VALEUR reste l'identifiant technique, c'est
            elle qui part à `addTenant` ; seul le texte lu est le libellé. */}
        <Field label={t('app.payments.selectUnit')} required>
          {(props) => (
            <Combobox
              id={props.id}
              aria-describedby={props['aria-describedby']}
              invalid={props['aria-invalid']}
              name="unitId"
              value={unitId}
              onChange={setUnitId}
              /* Dans une modale : la liste ne se déplie pas parce que le
                 dialogue vient de donner le focus. Voir `ouvrirAuFocus`. */
              ouvrirAuFocus={false}
              autoComplete="off"
              options={vacant.map((unit) => {
                const type = t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')
                /* LE QUARTIER PEUT MANQUER, et `.trim()` ne l'aurait pas vu :
                   il retire l'espace, pas le « · » resté seul derrière lui. On
                   assemble donc les morceaux PRÉSENTS plutôt que de recoudre
                   une chaîne trouée. */
                const quartier = buildingById(unit.buildingId)?.district
                return {
                  value: unit.id,
                  label: [`${unit.label} — ${type}`, quartier].filter(Boolean).join(' · '),
                }
              })}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
