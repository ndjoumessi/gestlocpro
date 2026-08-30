import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { useBase } from '@/lib/base'
import { Card } from '@/components/primitives/Card'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { GroupeDeFiltres } from '@/components/controls/GroupeDeFiltres'
import { Notice } from '@/components/primitives/Notice'
import { useToast } from '@/components/primitives/Toast'
import { EmptyState } from '@/components/primitives/DataTable'
import { StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { cn } from '@/lib/cn'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { TenantScopeNote } from './TenantDashboard'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { montantEngage, type WorkOrder } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { ReportModal } from './ReportModal'
import { OpenWorkModal } from './OpenWorkModal'
import { ReplyModal } from './ReplyModal'
import { Modal } from '@/components/primitives/Modal'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'

const STATUS_TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'neutral',
  quoted: 'warn',
  approved: 'info',
  done: 'ok',
}

export function Works() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { notify } = useToast()
  const { role } = useRole()

  // Seul le propriétaire arbitre : le gestionnaire propose. C'est la règle de
  // délégation, appliquée ici à l'affichage du bouton.
  const canApprove = role === 'owner'
  const isTenant = role === 'tenant'

  /**
   * Travaux et cautions vivent dans un état partagé : une décision prise ici
   * doit disparaître de la carte « Ce qui demande une décision » du tableau de
   * bord, qui la réclamait encore.
   */
  const {
    works,
    units,
    approveWork,
    quoteWork,
    unapproveWork,
    completeWork,
    reopenWork,
    unitById,
    isMine,
    loading,
  } = usePortfolio()
  const [signalementOuvert, setSignalementOuvert] = useState(false)
  const { money, parseAmount } = useCurrency()
  const [chantierOuvert, setChantierOuvert] = useState(false)
  /**
   * Le filtre d'ORIGINE, et il n'existe que pour le bailleur.
   *
   * Un locataire ne voit que ses propres signalements : trier « ce que j'ai
   * signalé » de « ce que le bailleur a décidé » lui proposerait un tri dont
   * une moitié est toujours vide.
   */
  const [origine, setOrigine] = useState<'all' | 'tenantReport' | 'ownerInitiative'>('all')
  const [aChiffrer, setAChiffrer] = useState<WorkOrder | null>(null)
  const [aRepondre, setARepondre] = useState<WorkOrder | null>(null)
  const [montant, setMontant] = useState('')
  const [montantErreur, setMontantErreur] = useState(false)

  // Le locataire suit les interventions sur SON logement, pas celles du parc.
  // Le périmètre vient du provider, qui le tient du serveur : le client ne
  // connaît plus « son » unité par une constante.
  /**
   * Le périmètre du LOCATAIRE d'abord, le filtre d'origine ensuite.
   *
   * Les deux ne sont pas de même nature et l'ordre le dit : le premier est un
   * cloisonnement que l'utilisateur ne choisit pas, le second un tri qu'il
   * demande.
   *
   * Les compteurs se calculent sur `duPerimetre` et non sur `works`, et il faut
   * dire honnêtement que cela NE CHANGE RIEN aujourd'hui : les segments ne sont
   * offerts qu'au bailleur et au gestionnaire, dont le périmètre est le parc
   * entier. Une mutation qui remplace l'un par l'autre ne fait rougir aucun cas,
   * vérifié.
   *
   * On l'écrit ainsi quand même, parce que la variable dit l'intention : un
   * compteur porte sur ce que l'utilisateur peut voir. Le jour où un rôle au
   * périmètre réduit accédera à cet écran — un gestionnaire délégué sur une
   * partie du parc, que l'adhésion sait déjà représenter — `works` annoncerait
   * des interventions qu'il n'a pas le droit de lire.
   */
  const duPerimetre = isTenant ? works.filter((w) => isMine(w.unitId)) : works
  const visible =
    origine === 'all' ? duPerimetre : duPerimetre.filter((w) => w.origin === origine)

  /**
   * CE QUE LE PARC A ENGAGÉ, et non ce qu'on lui a proposé.
   *
   * Aucun total n'existait sur cet écran — ni par immeuble, ni par métier, ni
   * du tout. Les cautions, les réserves d'état des lieux, les compteurs et les
   * impayés ont tous le leur ; les travaux, qui sont la seule dépense que le
   * bailleur DÉCIDE, n'en avaient aucun. Il pouvait valider douze devis sans
   * jamais voir la somme qu'ils font.
   *
   * `approvedAmount` seul : un devis proposé n'est pas une dépense, et
   * l'additionner ferait passer pour engagé ce qui attend encore un arbitrage.
   * C'est la distinction que le lot précédent a rendue lisible ligne à ligne —
   * le total la respecte, sans quoi les deux se contrediraient.
   *
   * Il suit le FILTRE, ce qui est tout son intérêt : basculer sur « à mon
   * initiative » répond à « combien m'ont coûté mes propres décisions ».
   */
  const engage = visible.reduce((somme, w) => somme + (w.approvedAmount ?? 0), 0)

  /* Les trois populations de la rangée d'indicateurs, tirées du MÊME `visible`
     que le total : elles suivent donc le filtre, et ne peuvent pas le
     contredire. */
  const aArbitrer = visible.filter((w) => w.status === 'quoted')
  const enCours = visible.filter((w) => w.status === 'approved')
  /* `signales` et non `aChiffrer` : ce nom-là désigne déjà, plus haut, la
     fiche que la modale de chiffrage est en train d'éditer. Deux notions
     voisines sous un même mot dans un même fichier finiraient par se
     confondre à la relecture. */
  const signales = visible.filter((w) => w.status === 'reported')

  const approve = (id: string) => {
    approveWork(id)
    // Valider engage une dépense, et se tromper de ligne dans une liste de
    // devis est ordinaire. Le retrait rend le devis à l'arbitrage sans effacer
    // la proposition : il n'y a rien à redemander à l'artisan.
    notify(t('app.works.approved_toast'), {
      tone: 'ok',
      action: { label: t('common.undo'), onClick: () => unapproveWork(id) },
    })
  }

  const mesUnites = units.filter((u) => isMine(u.id))

  /**
   * Retirer une validation, et rouvrir : DES BOUTONS, pas seulement un toast.
   *
   * Ces deux gestes n'existaient que comme action du message de confirmation,
   * lequel s'efface au bout de quatre secondes et demie. J'avais pourtant écrit
   * qu'une fenêtre qui expire en silence enseigne un filet qui n'existe pas —
   * puis livré exactement cela. La capacité était permanente côté serveur et
   * injoignable à l'écran passé le délai.
   */
  const reopen = (id: string) => {
    reopenWork(id)
    notify(t('app.works.reopened_toast'), { tone: 'ok' })
  }

  const unapprove = (id: string) => {
    unapproveWork(id)
    notify(t('app.works.unapproved_toast'), { tone: 'ok' })
  }

  const complete = (id: string) => {
    completeWork(id)
    /**
     * L'annulation est offerte AVEC le message, et elle est réelle.
     *
     * La maquette proposait une fenêtre de six secondes ; ce n'est pas ce qui
     * est livré. Une clôture prise pour une autre se découvre en relisant sa
     * liste, pas dans les six secondes — une fenêtre qui expire en silence
     * enseigne un filet qui n'existe pas. Le geste reste disponible ensuite par
     * la réouverture ; le toast n'en est que le chemin le plus court.
     */
    notify(t('app.works.completed_toast'), {
      tone: 'ok',
      action: { label: t('common.undo'), onClick: () => reopenWork(id) },
    })
  }

  /**
   * Cet écran porte un bouton qui engage de l'argent — « Valider le devis ».
   * Pendant l'attente, il en offrait deux, chiffrés, sur des interventions de
   * démonstration : le propriétaire validait une dépense de 185 000 FCFA qui ne
   * correspondait à rien, et le refus du serveur arrivait après la décision.
   */
  if (loading) return <WorksSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.works.title')}
        description={t('app.works.subtitle')}
        actions={
          /*
            DEUX gestes distincts, un par rôle — et le second est neuf.

            Ce commentaire disait : « le bailleur ne déclare toujours pas, c'est
            le locataire qui signale ». La prémisse était exacte à sa date et ne
            l'est plus : la route serveur acceptait les trois rôles depuis
            l'origine, seule l'interface refusait. Un bailleur qui remplaçait un
            chauffe-eau avant la panne n'avait aucun endroit où l'enregistrer,
            donc la dépense n'existait nulle part.

            Les deux verbes sont différents à dessein. Le locataire SIGNALE ce
            qu'il constate — il ne choisit ni le devis ni le corps de métier. Le
            bailleur OUVRE ce qu'il décide, sur un logement qu'il choisit.
            `origin` porte la distinction dans la donnée, ces deux boutons la
            portent à l'écran.

            `mesUnites[0]` : un locataire d'un seul logement n'a rien à choisir.
            Le jour où il en occupera deux, il faudra le lui demander — et le
            serveur, lui, revérifie déjà que le logement est bien le sien.
          */
          /*
            UN SEUL BOUTON À L'ÉCRAN, ET C'EST L'ÉCRAN QUI DIT LEQUEL.

            L'état vide porte le MÊME geste — « le même geste que l'en-tête, à
            l'endroit où il manque le plus », dit son commentaire, et il a
            raison. Mais les deux s'affichaient ENSEMBLE : sur un parc sans
            intervention, deux boutons primaires identiques, l'un en haut à
            droite et l'autre au centre, se disputaient le même clic. Vu sur une
            capture de production, jamais par une porte — la démonstration
            remplit toujours cet écran.

            L'arbitrage garde l'argument et supprime la concurrence : quand la
            liste est VIDE, le geste vit dans l'état vide, là où l'œil se pose ;
            dès qu'elle porte quelque chose, il remonte en en-tête, où il est
            atteignable sans défiler. Un seul bouton primaire par écran, à sa
            place selon ce que l'écran montre.

            Le locataire n'est pas concerné : son geste à lui — SIGNALER — n'est
            pas celui de l'état vide, qui le ramène à son espace. Les deux ne se
            recouvrent pas, donc rien ne les départage.
          */
          isTenant ? (
            mesUnites[0] ? (
              <Button icon="bell" onClick={() => setSignalementOuvert(true)}>
                {t('app.report.cta')}
              </Button>
            ) : undefined
          ) : visible.length === 0 ? undefined : (
            <Button icon="wrench" onClick={() => setChantierOuvert(true)}>
              {t('app.works.openCta')}
            </Button>
          )
        }
      />

      {isTenant && <TenantScopeNote className="mb-4" />}

      {/* Le bouton de validation disparaissait sans un mot pour le
          gestionnaire, alors qu'il voit les devis en attente : il lui restait à
          deviner si l'action manquait par droit ou par défaut. L'écran des
          cautions traite déjà le cas symétrique — les deux se répondent
          maintenant, puisque c'est la même règle de délégation. */}
      {role === 'manager' && works.some((work) => work.status === 'quoted') && (
        <Notice className="mb-4">{t('app.works.managerNotice')}</Notice>
      )}

      {/*
        LE TRI PAR ORIGINE, et le total qu'il commande.

        L'origine était affichée ligne à ligne sans qu'on puisse rien en faire.
        Un bailleur qui regarde ses travaux pose deux questions distinctes —
        « qu'est-ce qu'on me signale ? » et « qu'est-ce que j'ai engagé de ma
        propre initiative ? » — et une seule liste mêlée n'en servait aucune.

        Le motif est celui de `Payments` : compteurs sur chaque segment,
        `aria-pressed` pour l'état, et un nombre de segments qui ne dépend
        d'aucune donnée. Trois ici, comme il y a trois choses à demander.

        Rien de tout cela pour le locataire : il ne voit que ses propres
        signalements, donc une moitié du tri serait toujours vide — et le total
        engagé ne le regarde pas, c'est la règle des maquettes.
      */}
      {!isTenant && duPerimetre.length > 0 && (
        <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
          <GroupeDeFiltres
            libelle={t('app.works.filterOrigin')}
            valeur={origine}
            onChange={setOrigine}
            options={(['all', 'tenantReport', 'ownerInitiative'] as const).map((valeur) => ({
              valeur,
              libelle: t(
                valeur === 'all'
                  ? 'app.works.filterAll'
                  : valeur === 'tenantReport'
                    ? 'app.works.filterReported'
                    : 'app.works.filterOpened',
              ),
              compte:
                valeur === 'all'
                  ? duPerimetre.length
                  : duPerimetre.filter((w) => w.origin === valeur).length,
            }))}
          />

        </div>
      )}

      {/*
        LA RANGÉE D'INDICATEURS QUI MANQUAIT, et le total engagé y rentre.

        Il vivait en texte libre à droite des filtres — « Total engagé
        450 000 FCFA » —, seul chiffre d'un écran qui en compte trois. Les cinq
        écrans voisins ouvrent tous sur une rangée de cartes ; celui-ci
        demandait de lire cinq fiches pour savoir combien il y avait à arbitrer,
        alors que la donnée était déjà calculée.

        LES TROIS SUIVENT LE FILTRE, comme le total le faisait déjà : basculer
        sur « à mon initiative » répond à « combien m'ont coûté mes propres
        décisions », et il serait incohérent que deux cartes sur trois
        l'ignorent.

        L'ÉTAT SUR LES DEVIS, et sur eux seuls : un devis en attente est un
        travail qui n'avance pas tant que personne ne tranche. Zéro devis rend
        la carte neutre — c'est la règle que le retard applique déjà sur les
        paiements, une alerte permanente cesse d'être lue.

        PAS AU LOCATAIRE, et c'est une garde du dépôt qui me l'a rappelé plutôt
        que ma relecture. Le total engagé vivait dans le bloc réservé au
        bailleur ; en le sortant pour en faire une carte, je l'ai offert à tout
        le monde — et avec lui les montants proposés et le nombre de devis en
        attente. Un locataire a droit à savoir si SON chantier avance, pas à ce
        que le parc dépense. `origineDesTravaux.test.tsx` dit exactement cela
        depuis un lot antérieur : « n'expose ni devis ni engagé au locataire ».
      */}
      {!isTenant && visible.length > 0 && (
        <div className={cn(GRILLE_TROIS_INDICATEURS, 'mt-6')}>
          <StatCard
            icone="card"
            label={t('app.works.totalCommitted')}
            value={money(engage, { compact: true })}
            note={t('app.works.kpiCommittedNote')}
          />
          <StatCard
            icone="wrench"
            label={t('app.works.kpiQuoted')}
            value={String(aArbitrer.length)}
            etat={aArbitrer.length > 0 ? { ton: 'warn' } : undefined}
            note={t('app.works.kpiQuotedNote', {
              amount: money(
                aArbitrer.reduce((somme, w) => somme + (w.quotedAmount ?? 0), 0),
                { compact: true },
              ),
            })}
          />
          <StatCard
            icone="clipboard"
            label={t('app.works.kpiOngoing')}
            value={String(enCours.length)}
            note={t('app.works.kpiOngoingNote', { count: signales.length })}
          />
        </div>
      )}

      {/*
        L'état vide portait un titre et rien d'autre — et ce titre était écrit
        pour le locataire (« sur votre logement »), servi tel quel au
        propriétaire qui regarde tout le parc. Deux corrections tiennent
        ensemble : le texte se dit au bon destinataire, et il explique ce qui
        apparaîtra là plutôt que de répéter qu'il n'y a rien.

        L'action du bailleur, elle, a été CONSTRUITE depuis.

        Ce commentaire disait qu'aucune n'existait, et qu'un bouton « ajouter
        des travaux » serait « le mensonge d'interface habituel ». C'était juste
        tant que rien ne se passait derrière — la route serveur, elle, acceptait
        déjà. Le geste ouvre désormais sur une capacité réelle, et le corps du
        message change avec lui : il ne peut plus dire qu'une intervention naît
        d'un signalement, puisque la moitié des siennes naîtront d'une décision.
      */}
      {visible.length === 0 ? (
        <EmptyState
          icon="wrench"
          level={2}
          title={isTenant ? t('app.tenant.worksEmpty') : t('app.works.emptyTitle')}
          body={isTenant ? t('app.tenant.worksEmptyBody') : t('app.works.emptyBodyOwner')}
          // Le locataire, lui, est sur une impasse : rien à faire ici, et ses
          // données sont ailleurs. On le ramène là où elles sont — c'est le
          // même geste que `TenantRestricted`, et il existe vraiment.
          action={
            isTenant ? (
              <Button to={base} icon="chevronLeft">
                {t('app.tenant.backToSpace')}
              </Button>
            ) : (
              /* Le même geste que l'en-tête, à l'endroit où il manque le plus :
                 un parc sans aucune intervention est exactement celui où le
                 bailleur cherche par où commencer. */
              <Button icon="wrench" onClick={() => setChantierOuvert(true)}>
                {t('app.works.openCta')}
              </Button>
            )
          }
        />
      ) : (
      /*
        UNE LISTE, ET ELLE SE COMPTE.

        Une colonne de cartes sœurs n'est une liste que pour l'œil : à la
        lecture d'écran, on entendait une suite de titres sans jamais savoir
        combien il y en avait, ni où l'une s'arrêtait. `role="list"` donne les
        trois d'un coup — « liste de 6 éléments », la frontière de chacune, et
        le saut d'un élément au suivant sans tout parcourir.

        Le NOM est nécessaire et non décoratif : l'écran porte d'autres listes,
        et « liste, 6 éléments » ne dirait pas de quoi.

        « Interventions » et non « Interventions du parc » : le locataire ne voit
        que les siennes — `duPerimetre` filtre sur ses unités —, et le filtre
        d'origine restreint encore `visible`. Un nom qui promet le parc entier
        serait faux dans les deux cas ; `TenantScopeNote` dit déjà le périmètre
        à qui le subit.

        `list` et non `region` : dix interventions feraient dix repères dans le
        sommaire de la page, ce qui l'encombre au lieu de l'éclairer. Et non
        `group`, dont la spécification dit l'inverse de ce qu'on cherche — un
        ensemble « qui n'a pas vocation à figurer au sommaire ».
      */
      <div role="list" aria-label={t('app.works.listLabel')} className="flex flex-col gap-3">
        {visible.map((work) => {
          const unit = unitById(work.unitId)
          return (
            <Card
              key={work.id}
              role="listitem"
              /*
                LA CARTE SE REPLIE EN RANGÉE, ET LE TITRE GARDE UN PLANCHER.

                Un lot précédent a retiré `shrink-0` de la rangée de commandes,
                à droite : la page ne défile plus latéralement. Elle a cessé de
                déborder de la FENÊTRE — pas de la carte. Mesuré à 700 px sur
                /demo/travaux : la rangée de droite prend 518 px des 636, et la
                colonne du titre, `min-w-0 flex-1`, tombe à ZÉRO sur deux cartes
                sur trois. « Disjoncteur qui saute au démarrage du chauffe-eau »
                se rend alors dans une boîte de largeur nulle, un mot par ligne,
                et son texte se peint par-dessus la carte suivante.

                Aucune règle ne le voyait : `scrollX` reste à zéro. C'est
                `MESURER_DEBORD_LOCAL` qui l'a nommé, +81 px, et c'est le même
                défaut que la carte d'alerte — même remède.

                TOUT EST PRÉFIXÉ `sm:`, ET CE N'EST PAS DÉCORATIF. En dessous,
                la carte est une COLONNE : `basis-48` y fixerait une HAUTEUR de
                12 rem, et `ml-auto` pousserait la rangée de commandes contre le
                bord droit. Les trois classes ne valent que dans la branche
                rangée.
              */
              className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                  work.urgent ? 'bg-danger-tint text-danger' : 'bg-surface-sunken text-muted'
                }`}
              >
                <Icon name="wrench" size={20} />
              </span>

              {/* `sm:basis-48` — 12 rem, la largeur sous laquelle la colonne ne
                  descend plus. En dessous, `flex-wrap` renvoie les commandes à
                  la ligne suivante plutôt que de continuer à écraser le titre.
                  Même plancher que la carte d'alerte, pour la même raison : le
                  plus long mot des titres du produit tient dans 85 px, et il en
                  faut deux à trois par ligne pour qu'un titre se lise. */}
              <div className="min-w-0 flex-1 sm:basis-48">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="title-m">{workTitle(work, t)}</h2>
                  {work.urgent && <Badge tone="danger">{t('app.works.urgent')}</Badge>}
                </div>
                <p className="mt-1 text-caps text-muted">
                  {/* `work.id` est une référence de signalement, pas une unité :
                      il reste tel quel. `work.unitId`, lui, est l'identifiant
                      technique de l'unité — c'est son libellé qui se lit. */}
                  {work.reference ?? work.id} · {unit?.label} {unit?.tenant ? `· ${unit.tenant}` : ''} ·{' '}
                  {t(`app.trades.${work.trade}` as 'app.trades.plumbing')} ·{' '}
                  {d.dayMonth(work.reportedAt)}
                </p>
                {/*
                  D'OÙ ELLE VIENT, et de qui.

                  L'écran ne le disait pas, et le serveur ne le rendait pas :
                  `reportedByTenantId` était écrit depuis l'origine et lu nulle
                  part. Le bailleur recevait donc un problème sans savoir qui
                  l'avait vu — il ne pouvait ni rappeler, ni faire ouvrir la
                  porte à l'artisan.

                  Rien ne s'affiche quand l'origine manque : une intervention
                  antérieure à ce champ n'a pas de déclarant connu, et écrire
                  « signalé par » sans nom serait pire que le silence.

                  ELLE PARAÎT MÊME QUAND LE NOM EST DÉJÀ AU-DESSUS, et c'est
                  une décision revenue sur elle-même.

                  La ligne de référence porte le locataire du logement ; sur
                  quatre signalements sur cinq de la démonstration, c'est la même
                  personne, et l'écran écrit donc « … · Serge Mbarga » puis
                  « Signalé par Serge Mbarga » à une ligne d'intervalle. Ce lot a
                  d'abord masqué la seconde ligne dans ce cas.

                  `origineDesTravaux.test.tsx` l'a refusé, et il avait raison :
                  ce ne sont pas deux fois le même fait. « Le logement est loué à
                  X » et « X a signalé ceci » sont deux affirmations distinctes
                  qui NOMMENT la même personne. Les confondre oblige le lecteur à
                  déduire la seconde de la première — or ce que le bailleur
                  cherche ici est précisément qui rappeler pour faire ouvrir la
                  porte à l'artisan, et une déduction n'est pas une réponse.

                  Le coût est réel — un nom écrit deux fois — et il est le prix
                  d'une affirmation qu'aucune autre ligne ne fait.
                */}
                {work.origin && (
                  <p className="mt-1 text-body text-muted">
                    {work.reportedBy
                      ? t(
                          work.origin === 'ownerInitiative'
                            ? 'app.works.openedByNamed'
                            : 'app.works.reportedByNamed',
                          { name: work.reportedBy },
                        )
                      : t(
                          work.origin === 'ownerInitiative'
                            ? 'app.works.openedBy'
                            : 'app.works.reportedBy',
                        )}
                  </p>
                )}
              </div>

              {/* `flex-wrap` SANS `shrink-0`, comme `PageHeader` : la paire
                  s'était propagée jusqu'ici, et elle s'y contredisait pareil.
                  `shrink-0` interdit à cette rangée de descendre sous sa
                  largeur `max-content`, donc le repli que `flex-wrap` déclare
                  vouloir n'arrivait jamais. Mesuré sur `/demo/travaux` à 700 px
                  en français : 585 px réclamés, bord droit à 714 dans une
                  fenêtre de 700, `scrollX=14` — « Marquer terminé » sortait du
                  champ et TOUTE la page défilait latéralement. Le bloc voisin
                  porte déjà `min-w-0 flex-1` : c'est lui qui cède la place, et
                  le titre de l'intervention se replie, ce qu'un titre sait
                  faire. */}
              <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                {/*
                  LE MONTANT DIT CE QU'IL EST : proposé, ou engagé.

                  C'était un nombre nu à côté de la pastille de statut, et le
                  lecteur devait déduire du statut s'il regardait un devis ou une
                  dépense. Le client aplatissait d'ailleurs les deux champs du
                  serveur en un seul — le devis d'origine disparaissait dès
                  qu'une validation existait, alors que l'écart entre proposé et
                  engagé est exactement ce qu'un bailleur veut voir.
                */}
                {/*
                  ET PAS AU LOCATAIRE — une fuite qui précède ce chantier.

                  La règle est celle des maquettes, appliquée partout ailleurs :
                  « le coût des travaux n'est jamais exposé au locataire ». Son
                  espace ne l'affiche pas, l'écran Signaler non plus — et un cas
                  le garde là-bas. Mais l'écran des travaux, lui, le montrait à
                  qui l'ouvrait, sans aucune condition de rôle.
                  `coquilleLocataire` a retiré « Travaux » de sa navigation, ce
                  qui a rendu le défaut invisible sans le corriger : la route
                  reste atteignable, et `tenantIsolation` garde justement
                  qu'elle le reste.

                  Le devis et l'engagé regardent celui qui paie. Le locataire
                  voit le statut, ce qui répond à sa seule question : est-ce que
                  ça avance ?
                */}
                {!isTenant && <Montant work={work} />}

                <StatusPill tone={STATUS_TONE[work.status]} size="sm">
                  {t(`app.works.${work.status}` as 'app.works.reported')}
                </StatusPill>

                {/*
                  CHIFFRER : l'action centrale du gestionnaire, et elle n'avait
                  aucun bouton. La route existait, la méthode du fournisseur
                  aussi — rien ne les appelait. « Le locataire signale, le
                  gestionnaire chiffre, le propriétaire arbitre » dit le
                  sous-titre de cet écran ; le deuxième maillon manquait.
                */}
                {/*
                  RÉPONDRE : le retour que le locataire n'a jamais eu.

                  Il déclare une fuite, puis regarde une pastille avancer —
                  « déclaré », « devisé », « validé » — sans jamais apprendre
                  quand quelqu'un passera. Les deux routes existaient depuis le
                  lot précédent et RIEN ne les appelait : un canal branché des
                  deux côtés du serveur et muet à l'écran ne répond à personne.

                  Sur une intervention QUE LE LOCATAIRE A OUVERTE, et sur elle
                  seule : celle que le bailleur s'est ouverte à lui-même n'a
                  personne à qui répondre, et le serveur la refuse en 409. On ne
                  propose pas un geste qu'on refusera.

                  À tout statut, y compris `done` : « c'est réparé, l'artisan
                  est passé jeudi » est précisément la réponse qui manque le
                  plus. Le locataire ne la lisait nulle part.
                */}

                {work.status === 'reported' && role !== 'tenant' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAChiffrer(work)
                      setMontant('')
                      setMontantErreur(false)
                    }}
                  >
                    {t('app.works.quote')}
                  </Button>
                )}


                {work.status === 'quoted' && canApprove && (
                  /*
                    UNE ACTION DE RANGÉE N'EST PAS L'ACTION DE LA PAGE.

                    Ce bouton était le seul du produit à porter la variante
                    PRIMAIRE à l'intérieur d'une liste. Mesuré le 2026-08-30 à
                    1660 px, en comptant les fonds pleins de la marque :
                    `/demo/paiements`, `/demo/locataires` et `/demo/acces` en
                    portent un par page — plus celui du bandeau de
                    démonstration. `/demo/travaux` en portait TROIS.

                    Et le compte grandit avec la donnée : la démonstration n'a
                    qu'un devis en attente, un parc réel en aurait cinq, donc
                    cinq bleus qui se disputeraient l'œil entre eux ET avec
                    « Ouvrir un chantier ».

                    CE QUI SIGNALE DÉJÀ CETTE RANGÉE, ce n'est pas le bouton :
                    c'est la pastille ambre « Devis proposé », qui est faite pour
                    ça et qui reste. Le bleu ajoutait un second signal au même
                    endroit, ce qui n'en fait pas un plus fort — cela en fait un
                    plus bruyant.

                    ET L'ACTION EST RÉVERSIBLE, ce qui achève l'argument.
                    VÉRIFIÉ DANS `approve()` plutôt que supposé : il n'y a
                    AUCUNE modale de confirmation — le devis est validé sur-le-
                    champ, et le toast offre un RETRAIT qui « rend le devis à
                    l'arbitrage sans effacer la proposition ». Une action qu'on
                    défait d'un geste n'a pas besoin d'un bouton qui crie ; c'est
                    l'irréversible qui mérite du bleu, et il n'y en a pas ici.

                    La première rédaction de ce commentaire disait « c'est la
                    modale de confirmation qui porte cette gravité ». Elle
                    n'existe pas. La phrase est remplacée plutôt que corrigée à
                    demi.
                  */
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => approve(work.id)}
                  >
                    {t('app.works.approve')}
                  </Button>
                )}

                {/*
                  Clore : le geste qui manquait, et son absence se voyait.

                  `approved` était en pratique TERMINAL — un devis validé
                  engageait la dépense et restait « à faire » indéfiniment, donc
                  cette liste ne pouvait que grandir. Un logiciel de gestion dont
                  la liste de travaux ne se vide jamais cesse d'être lu.

                  Offert sur `reported` aussi : tout n'a pas de coût, et une
                  intervention jamais chiffrée n'a rien à faire arbitrer. Jamais
                  sur `quoted` — le serveur le refuse, parce que clore un devis
                  en attente le ferait disparaître de la carte du propriétaire
                  sans qu'il ait rien décidé.

                  Le locataire consulte : il ne constate pas l'achèvement des
                  travaux de son bailleur.
                */}
                {(work.status === 'approved' || work.status === 'reported') &&
                  role !== 'tenant' && (
                    <Button variant="secondary" size="sm" onClick={() => complete(work.id)}>
                      {t('app.works.complete')}
                    </Button>
                  )}

                {/*
                  CE QUI DÉFAIT ET CE QUI ACCOMPAGNE PASSE DERRIÈRE TROIS POINTS.

                  La rangée alignait le montant, la pastille et jusqu'à TROIS
                  gestes. Ce fichier porte déjà la mesure du dégât, quelques
                  lignes plus haut : « 585 px réclamés, bord droit à 714 dans une
                  fenêtre de 700, scrollX=14 ». Le repli l'a armé depuis — mais
                  il replie, et la carte grandit d'une ligne, cinq fois.

                  C'est la même question que l'en-tête de page a tranchée, un
                  niveau plus bas, et rien ne justifiait qu'elle y réponde
                  autrement sinon que personne ne l'avait posée.

                  CE QUI RESTE FAIT AVANCER : chiffrer, valider, clore. CE QUI SE
                  REPLIE défait ou accompagne — retirer une validation, rouvrir
                  un chantier clos, écrire au locataire. Aucun geste n'est
                  retiré, et le menu disparaît de lui-même quand il n'a rien à
                  porter : sur une intervention devisée que le bailleur s'est
                  ouverte à lui-même, il n'y a rien derrière les trois points, et
                  il n'y a donc pas de trois points.
                */}
                <MenuDeDebordement libelle={t('common.moreActions')}>
                  {work.origin === 'tenantReport' && work.reportedBy && role !== 'tenant' ? (
                    <MenuElement icone="bell" onClick={() => setARepondre(work)}>
                      {t('app.works.reply')}
                    </MenuElement>
                  ) : null}
                  {work.status === 'approved' && canApprove ? (
                    <MenuElement onClick={() => unapprove(work.id)}>
                      {t('app.works.unapprove')}
                    </MenuElement>
                  ) : null}
                  {work.status === 'done' && role !== 'tenant' ? (
                    <MenuElement onClick={() => reopen(work.id)}>
                      {t('app.works.reopen')}
                    </MenuElement>
                  ) : null}
                </MenuDeDebordement>
              </div>
            </Card>
          )
        })}
      </div>
      )}

      {aChiffrer && (
        <Modal
          open
          onClose={() => setAChiffrer(null)}
          size="sm"
          title={t('app.works.quoteTitle')}
          /*
            LA MODALE NOMME CE QU'ELLE CHIFFRE.

            Elle s'ouvrait sur « Chiffrer l'intervention » — laquelle ? L'écran
            en aligne parfois une dizaine, et le geste est IRRÉVERSIBLE : le
            serveur refuse un rechiffrage en 409, avec un motif juste
            (« rechiffrer un devis déjà validé changerait le montant sous la
            décision du propriétaire »). Se tromper de ligne coûte donc un
            devis, définitivement.

            C'est le seul des trois actes de cet écran à ne pas dire sur quoi il
            porte : répondre au locataire nomme le déclarant, retirer une fiche
            nomme le locataire.
          */
          description={t('app.works.quoteOn', {
            // `workTitle` et non `title` : le jeu de démonstration porte une
            // CLÉ, une saisie d'utilisateur porte un texte, et ce fichier a
            // déjà tranché le point pour son en-tête de carte. Lire `title`
            // directement rendait un titre vide sur toute intervention de
            // démonstration — c'est-à-dire sur tout ce qu'on regarde en
            // développant.
            title: workTitle(aChiffrer, t),
            unit: unitById(aChiffrer.unitId)?.label ?? aChiffrer.unitId,
          })}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAChiffrer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  // `parseAmount` et non `Number` : le champ prend le montant
                  // tel qu'il se lit à l'écran. Retirer les espaces à la main
                  // sauvait la fine insécable des milliers — `\s` la couvre — et
                  // perdait la virgule décimale : « 35 000,50 » devenait `NaN`,
                  // donc un refus que rien ne justifiait, sur un montant que le
                  // produit venait lui-même d'imprimer sous cette forme.
                  const valeur = parseAmount(montant)
                  // La même borne que le serveur — « un devis est strictement
                  // positif » — pour que le refus arrive avant l'aller-retour.
                  // `null` s'y ajoute : `parseAmount` distingue l'illisible du
                  // zéro là où `Number` les confondait dans un `NaN` que seul
                  // `Number.isFinite` savait rattraper.
                  if (valeur === null || valeur <= 0) {
                    setMontantErreur(true)
                    return
                  }
                  quoteWork(aChiffrer.id, Math.round(valeur))
                  setAChiffrer(null)
                  notify(t('app.works.quoted_toast'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <Field
            label={t('app.works.quoteAmount')}
            hint={t('app.works.quoteHint')}
            required
            {...(montantErreur ? { error: t('app.works.quoteError') } : {})}
          >
            {(champ) => (
              <Input
                {...champ}
                inputMode="numeric"
                value={montant}
                invalid={montantErreur}
                onChange={(e) => {
                  setMontant(e.target.value)
                  setMontantErreur(false)
                }}
              />
            )}
          </Field>
        </Modal>
      )}

      {/* Rendue sans condition de rôle sur le montage : la modale se ferme sur
          `work === null`, et le bouton qui l'ouvre porte déjà la garde. */}
      <ReplyModal work={aRepondre} onClose={() => setARepondre(null)} />

      {role === 'tenant' && mesUnites[0] && (
        <ReportModal
          open={signalementOuvert}
          onClose={() => setSignalementOuvert(false)}
          unitId={mesUnites[0].id}
        />
      )}

      {/* Le bailleur choisit son logement dans TOUT le parc : c'est la seule
          différence de forme entre les deux modales, et c'est celle qui
          interdisait de partager `ReportModal`, dont l'unité arrive toute faite
          en prop. `units` et non `visible` : on ouvre un chantier sur un
          logement, pas sur une intervention. */}
      {!isTenant && units.length > 0 && (
        <OpenWorkModal
          open={chantierOuvert}
          onClose={() => setChantierOuvert(false)}
          unitIds={units.map((u) => ({ id: u.id, label: u.label }))}
        />
      )}
    </>
  )
}

/**
 * Les travaux, le temps qu'ils arrivent.
 *
 * L'en-tête ne porte aucune action : rien à retenir de ce côté-là. Le bandeau
 * de périmètre du locataire et l'avis au gestionnaire ne sont pas reproduits —
 * tous deux se déclenchent sur les données (« a-t-il des devis en attente ? »),
 * donc les annoncer reviendrait à répondre à une question qu'on ne sait pas
 * encore trancher.
 *
 * Trois cartes, et non huit : ce sont des cartes hautes, trois remplissent déjà
 * l'écran d'un téléphone. Leur gabarit suit celui d'une intervention réelle —
 * la vignette de 44px, le titre, la ligne de références — pour que la liste ne
 * saute pas quand elle arrive.
 */
function WorksSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('app.works.title')} description={t('app.works.subtitle')} />

      <SkeletonRegion className="flex flex-col gap-3">
        {[0, 1, 2].map((carte) => (
          <Card key={carte} className="flex items-center gap-4">
            <Skeleton radius="md" className="size-11" />
            <div className="min-w-0 flex-1">
              <Skeleton line="title" className="w-64 max-w-full" />
              <Skeleton line="eyebrow" className="mt-1 w-48 max-w-full" />
            </div>
            <Skeleton line="title" radius="md" className="hidden w-28 sm:block" />
            <Skeleton radius="md" className="hidden h-7 w-24 sm:block" />
          </Card>
        ))}
      </SkeletonRegion>
    </>
  )
}

/**
 * Ce qu'a coûté une intervention, ou ce qu'elle coûterait.
 *
 * Le devis RESTE visible sous l'engagé quand les deux diffèrent : un devis à
 * 78 000 validé à 78 000 se lit comme une dépense tenue, le même validé après
 * révision à 95 000 est une dérive. Les confondre effaçait la seule information
 * que ce couple porte.
 */
function Montant({ work }: { work: WorkOrder }) {
  const t = useT()
  const { money } = useCurrency()
  const { montant, nature } = montantEngage(work)

  if (montant === null) {
    return (
      <span className="text-body text-muted italic">{t('app.works.noQuote')}</span>
    )
  }

  const revise =
    nature === 'approved' && work.quotedAmount !== null && work.quotedAmount !== montant

  return (
    <span className="flex flex-col items-end">
      <span className="numeric text-title-m font-medium">{money(montant, { compact: true })}</span>
      <span className="text-caps text-muted">
        {t(nature === 'approved' ? 'app.works.amountApproved' : 'app.works.amountQuoted')}
      </span>
      {revise && (
        <span className="numeric text-caps text-muted">
          {t('app.works.amountWasQuoted', { amount: money(work.quotedAmount!, { compact: true }) })}
        </span>
      )}
    </span>
  )
}
