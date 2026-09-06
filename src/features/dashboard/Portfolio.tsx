import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRole } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { PaymentStatusPill, StatusPill } from '@/components/primitives/StatusPill'
import { ProgressBar, StatCard } from '@/components/primitives/Charts'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import {
  Skeleton,
  SkeletonRegion,
  SkeletonStatRow,
  SkeletonTable,
} from '@/components/primitives/Skeleton'
import { GRILLE_TROIS_INDICATEURS } from './grillesDIndicateurs'
import { AU_DELA_LG, useAuDela } from '@/lib/useAuDela'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Icon } from '@/components/primitives/Icon'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/primitives/Toast'
import type { Immeuble } from '@/data/apiPortfolio'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { AddBuildingModal } from './AddBuildingModal'
import { ParkSettingsModal } from './ParkSettingsModal'
import { AddUnitModal } from './AddUnitModal'
import { EditBuildingModal } from './EditBuildingModal'
import { EditUnitModal } from './EditUnitModal'

export function Portfolio() {
  const base = useBase()
  /**
   * Portée jusqu'au dossier d'un logement, pour que « Retour » y revienne.
   *
   * Le bouton « bouton précédent » du navigateur rétablit déjà l'immeuble
   * filtré — le filtre vit dans l'URL, exprès pour ça. Le lien « Retour » du
   * dossier, lui, pointait en dur vers `parc` nu : les deux chemins pour
   * revenir en arrière ne menaient plus au même endroit, l'un gardait le
   * filtre, l'autre le perdait. `location.search` porte `?immeuble=…` quand un
   * immeuble est choisi, rien sinon — il suffit à reconstituer l'état exact
   * d'où l'on partait.
   */
  const location = useLocation()
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [logementOuvert, setLogementOuvert] = useState(false)
  const [correctionOuverte, setCorrectionOuverte] = useState(false)
  /* DEUX CORRECTIONS DE PLUS, et elles ferment le dernier trou du parc :
     jusqu'ici un immeuble ne se corrigeait pas et un logement ne se touchait
     pas du tout. Voir `EditBuildingModal` et `EditUnitModal`. */
  const [immeubleACorriger, setImmeubleACorriger] = useState<Immeuble | null>(null)
  const [logementACorriger, setLogementACorriger] = useState<Unit | null>(null)
  /**
   * LE MÊME SEUIL QUE LA BASCULE EN FICHES, et c'est ce qui rend la page
   * cohérente : au-dessus, un TABLEAU et des cartes alignées ; en dessous, des
   * fiches GROUPÉES dont les en-têtes portent ce que les cartes portaient.
   *
   * ═══ POURQUOI LES CARTES PARTENT SOUS CE SEUIL ═══
   *
   * Le lot qui a posé les barres d'occupation dit pourquoi elles valent : « la
   * grille aligne les cartes, donc les barres partagent origine et longueur : le
   * classement se lit en travers ». C'est vrai là où la grille a deux ou quatre
   * colonnes.
   *
   * En fiches, elle n'en a qu'une : les barres s'empilent, ne partagent plus
   * d'origine, et le classement ne se lit plus en travers de rien. 641 px
   * mesurés à 375 px — quinze pour cent de l'écran — pour une comparaison que la
   * mise en page rend impossible.
   *
   * L'ARGUMENT QUI PORTE TOUTE LA PLAGE EST L'AUTRE : le nom de l'immeuble était
   * écrit DOUZE fois pour trois immeubles. Celui de la comparaison est le plus
   * net à 360 ; celui de la répétition vaut partout où l'on empile.
   */
  const { adhesionActive, estDemo } = useSession()
  const { role } = useRole()
  /**
   * Corriger le parc engage l'unité de tous ses montants : c'est le
   * propriétaire, comme pour la validation d'un devis.
   *
   * LA CONDITION A CHANGÉ, ET ELLE CONFONDAIT DEUX CHOSES. Elle lisait
   * `adhesionActive?.role === 'owner'`, avec pour motif « sans adhésion il n'y a
   * pas de parc à qui écrire ». C'est vrai d'un compte connecté SANS parc — et
   * faux de la DÉMONSTRATION, où l'absence d'adhésion ne signifie pas qu'il n'y
   * a personne à qui écrire mais que rien ne s'écrit, ce qui est le cas de tous
   * les gestes de cet écran.
   *
   * CE QUE LA CONFUSION COÛTAIT est plus large qu'un bouton manquant :
   * `ParkSettingsModal` devenait INATTEIGNABLE dans la démonstration, donc hors
   * de portée de `scripts/modales.mjs` — qui la comptait en dette sous
   * `NON_OUVRABLES` — ET de la mesure de contraste, qui ne visite que `/demo`.
   * Sa géométrie et ses couleurs n'étaient mesurées par PERSONNE, dans aucun
   * thème. Le lot qui a regardé le sombre à l'œil ne pouvait pas l'ouvrir non
   * plus. Une modale qu'aucune porte ne peut atteindre est une modale qui dérive.
   *
   * Le rôle ACTIF est le bon critère : en démonstration il vient du sélecteur de
   * profil, sur un vrai compte il est synchronisé sur l'adhésion. La modale, de
   * son côté, sait déjà qu'elle n'a pas de parc — son envoi commence par un
   * garde — et le DIT désormais au lieu de ne rien faire.
   */
  const peutCorrigerLeParc = role === 'owner' && (adhesionActive !== null || estDemo)
  const t = useT()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { money } = useCurrency()
  const { units, buildings: BUILDINGS, buildingById, loading, removeBuilding, scoped } =
    usePortfolio()
  const { notify } = useToast()
  /** L'immeuble dont la suppression attend confirmation. */
  const [aSupprimer, setASupprimer] = useState<Immeuble | null>(null)
  const [query, setQuery] = useState('')

  /**
   * LES IMMEUBLES REPLIÉS — la forme que 21st a apprise au dépôt.
   *
   * Reprise du CHEVRON AVANT LE LIBELLÉ (`accordion-07`, felipemenezes098) :
   * l'affordance de repli précède le nom au lieu de le suivre à l'autre bout de
   * la rangée. Sur une liste de blocs, l'œil descend une COLONNE de chevrons et
   * lit les plis avant de lire les noms ; posé à droite, chaque chevron est à
   * une distance différente du nom qu'il commande, et la colonne n'existe plus.
   *
   * ═══ LE REPLI NE PASSE PAS PAR `DataTable` ═══
   *
   * Un immeuble replié retire ses LIGNES, pas son groupe : `ordre` déclare tous
   * les immeubles, donc l'en-tête reste rendu avec son rapport, sa barre et ses
   * gestes. Il suffit que `rows` n'en porte plus les logements. La primitive n'a
   * rien à apprendre du repli, et les six autres écrans qui l'emploient ne
   * changent pas d'une ligne.
   *
   * ═══ OUVERTS PAR DÉFAUT ═══
   *
   * Un parc s'ouvre sur ce qu'il contient. Replier d'entrée demanderait un geste
   * pour voir la donnée qu'on vient chercher — et le repli sert à RANGER ce
   * qu'on a fini de lire, pas à cacher ce qu'on n'a pas encore lu. L'état ne
   * survit pas au rechargement, et c'est assumé : voir la note de fin de lot.
   */
  const [replies, setReplies] = useState<ReadonlySet<string>>(new Set())
  const basculerLeRepli = (id: string) =>
    setReplies((avant) => {
      const suite = new Set(avant)
      if (!suite.delete(id)) suite.add(id)
      return suite
    })

  /*
    LE FILTRE D'IMMEUBLE EST PARTI AVEC SES PASTILLES, et l'URL avec lui.

    Il vivait dans `?immeuble=`, pour survivre à un aller-retour vers le dossier
    d'un logement. Le groupement le rend sans objet : les trois immeubles sont
    déjà séparés, chacun sous son en-tête, et il n'y a plus rien à isoler — on
    déroule au lieu de filtrer.

    IL ÉTAIT DEVENU FAUX, en plus d'être inutile. `ordre` déclare TOUS les
    immeubles pour que celui qui n'a aucun logement garde son en-tête et ses
    gestes. Un filtre actif ne retirait donc pas les autres immeubles, il les
    vidait : deux en-têtes suivis de rien, au milieu de la liste.

    CE QUE ÇA COÛTE : `/demo/parc?immeuble=…` n'est plus une adresse partageable.
    C'est une perte réelle, assumée — un filtre qui ne peut plus rien retirer
    n'est pas un filtre, et le mécanisme n'avait plus d'interface pour le poser.

    La RECHERCHE reste, et reste locale : une frappe en cours de saisie est
    personnelle et éphémère, la pousser dans l'URL écrirait une entrée
    d'historique par caractère.
  */
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return units.filter((unit) => {
      /* LE REPLI RETIRE LES LIGNES, ET RIEN D'AUTRE. L'en-tête du groupe reste
         rendu — `ordre` le déclare — donc le rapport, la barre et les gestes de
         l'immeuble replié restent lisibles et atteignables. */
      if (replies.has(unit.buildingId)) return false
      if (!needle) return true
      const haystack = [
        // Le libellé et non l'identifiant : c'est « A1 » que l'utilisateur voit
        // dans la colonne et retape ici, pas l'uuid que servira l'API.
        unit.label,
        // La typologie est cherchée sur son libellé traduit et non sur la clé :
        // un anglophone qui voit « 2-bed » à l'écran tape « bed », pas « T3 ».
        t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1'),
        unit.tenant ?? '',
        buildingById(unit.buildingId)?.name ?? '',
        buildingById(unit.buildingId)?.district ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
    /* `buildingById` MANQUAIT, et la recherche s'en sert pour deux champs de sa
       botte de foin — le nom de l'immeuble et son quartier. Elle venait du
       contexte, donc son identité suit `buildings` ; sans elle ici, un immeuble
       renommé ne devenait cherchable qu'au prochain changement de `units`.
       C'était vrai EN PRATIQUE — le portefeuille est remplacé en entier après
       une correction — mais tenu par un enchaînement, pas par la dépendance. */
  }, [query, units, t, buildingById, replies])

  /**
   * SORTIR L'ÉTAT DU PARC, une ligne par logement.
   *
   * DÉJÀ BORNÉ, SANS QU'ON LE BORNE. `usePortfolio` ne rend au gestionnaire que
   * ce qui lui est confié : le fichier suit son périmètre sans une ligne de
   * plus. Recopier ici un filtre de rôle aurait créé un second cloisonnement,
   * à faire vieillir avec le premier — et c'est le premier qui protège.
   *
   * IL SUIT LE FILTRE D'IMMEUBLE ET LA RECHERCHE, comme l'export des paiements
   * suit le sien : on exporte ce qu'on regarde. Le nom du fichier ne le dit pas
   * encore, faute d'un libellé court pour une recherche libre — deux exports
   * successifs peuvent donc se recouvrir, et c'est un manque assumé.
   */
  const exporterLeParc = () =>
    exportCsv({
      name: t('app.files.portfolio'),
      headers: [
        t('app.portfolio.building'),
        t('app.portfolio.district'),
        t('app.portfolio.unit'),
        t('app.portfolio.type'),
        t('app.portfolio.surface'),
        t('app.portfolio.tenant'),
        csvMoney.header(t('app.portfolio.rent')),
        /* LE FICHIER SUIT LA TABLE, deux colonnes et non une. Séparer l'écran
           sans séparer l'export aurait laissé le mélange exactement là où on va
           le compter : un tableur qui trie sur « Statut » remettrait « Vacant »
           dans la même pile que « En retard ». */
        t('app.portfolio.occupation'),
        t('app.portfolio.status'),
      ],
      rows: rows.map((unit) => [
        buildingById(unit.buildingId)?.name ?? '',
        buildingById(unit.buildingId)?.district ?? '',
        // Le libellé, jamais l'identifiant : un fichier qui listerait des uuid
        // serait inexploitable. Même règle que l'export des paiements.
        unit.label,
        t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1'),
        unit.surface,
        unit.tenant ?? t('app.portfolio.noTenant'),
        csvMoney.amount(unit.rent),
        unit.status === 'vacant' ? t('status.vacant') : t('app.portfolio.occupied'),
        /* Vide et non « Vacant » : la colonne de paiement d'un logement sans
           bail n'a pas de valeur, et une cellule vide se filtre dans un tableur
           là où un libellé recréerait la catégorie qu'on vient de retirer. */
        unit.status === 'vacant' ? '' : t(`status.${unit.status}` as 'status.paid'),
      ]),
    })

  const occupied = units.filter((u) => u.status !== 'vacant').length

  /**
   * L'occupation par immeuble se dérive de l'état vivant.
   *
   * Elle lisait `BUILDINGS`, une constante figée, tandis que la carte globale
   * juste à côté comptait les unités du provider. Rattacher un locataire fait
   * passer une unité de `vacant` à `pending` : le total bougeait, les quatre
   * cartes d'immeuble non. Deux chiffres contradictoires sur la même ligne.
   */
  const occupancyOf = (buildingId: string) => {
    const inBuilding = units.filter((u) => u.buildingId === buildingId)
    return { occupied: inBuilding.filter((u) => u.status !== 'vacant').length, total: inBuilding.length }
  }

  /**
   * LE TAUX, BORNÉ UNE FOIS POUR LES QUATRE TUILES.
   *
   * La division vivait à un seul endroit de cet écran — la carte du parc — et
   * elle y était écrite à la main, sans borne, jusqu'à ce qu'un compte neuf y
   * lise « NaN % ». Les barres posées par ce lot en demandent trois de plus, une
   * par immeuble, et un immeuble SANS logement est bien plus courant qu'un parc
   * vide : c'est l'état de tout immeuble entre sa création et son premier
   * logement. Quatre divisions recopiées auraient rouvert quatre fois le même
   * défaut ; celle-ci rend 0 sur un dénominateur nul, comme `computeKpis`.
   */
  /* SOUS `lg`, LE BANDEAU SE TAIT — et ce n'est pas une omission.

     `indicateursEnDouble` l'a refusé en une phrase : « /demo/parc — "83", déjà
     sur le tableau de bord ». Sur un téléphone ces cent pixels redisent un
     chiffre qui est à un onglet de distance, en tête d'un écran qui fait déjà
     trois mille pixels de haut. Le lot des fiches avait pris cette décision
     pour la grille ; le bandeau en hérite, pour la même raison mesurée.

     L'occupation ne disparaît pas pour autant : chaque en-tête de groupe porte
     celle de son immeuble, qui est ce qu'on lit sur place. */
  const enTableau = useAuDela(AU_DELA_LG)

  const tauxDe = (occupees: number, total: number) =>
    total === 0 ? 0 : Math.round((occupees / total) * 100)

  /**
   * LES IMMEUBLES SANS LOGEMENT FERMENT LA LISTE.
   *
   * Un immeuble à `0/0` n'est pas un immeuble peu occupé : c'est un immeuble
   * qu'on vient de créer et qu'on n'a pas encore rempli. Rangé à sa place
   * alphabétique, il coupe la liste en deux avec un en-tête suivi de RIEN — un
   * trou au milieu de ce qu'on est en train de lire. Un parc qui grandit en
   * accumule autant qu'il crée d'immeubles d'avance.
   *
   * Groupés en fin de liste, ils restent atteignables — leurs gestes de
   * correction et de retrait vivent dans leur en-tête, et c'est le seul endroit
   * d'où on les atteint depuis que les cartes sont parties.
   *
   * PARTITION STABLE, ET NON UN TRI PAR TAUX. L'ordre des immeubles pleins ne
   * bouge pas : classer par occupation ferait sauter un immeuble d'un rang à
   * l'autre au premier bail signé, sur un écran qu'on relit tous les jours. Ce
   * qu'on demande à cette liste, c'est de ne pas être trouée — pas d'être un
   * classement.
   */
  const ordreDesImmeubles = [
    ...BUILDINGS.filter((b) => occupancyOf(b.id).total > 0),
    ...BUILDINGS.filter((b) => occupancyOf(b.id).total === 0),
  ].map((b) => b.id)

  /**
   * Placé après les crochets — ils doivent tourner à chaque rendu — et avant le
   * moindre affichage de `units`.
   *
   * C'est l'écran où le mensonge se voyait le plus : douze lignes de logements,
   * avec leurs locataires et leurs loyers, dans un tableau qui invite à
   * chercher, filtrer et cliquer. Un gestionnaire qui tape le nom d'un de ses
   * locataires pendant l'attente obtient « Aucun résultat » sur un parc qui
   * n'est pas le sien.
   */
  if (loading) return <PortfolioSkeleton />

  return (
    <>
      <PageHeader
        title={t('app.portfolio.title')}
        description={t('app.portfolio.subtitle', {
          buildings: t('common.buildingCount', { count: BUILDINGS.length }),
          units: t('common.unitCount', { count: units.length }),
        })}
        // Le seul endroit du produit où l'on constitue son parc. Il n'existait
        // pas : tous les écrans opéraient sur des immeubles qu'aucun geste ne
        // pouvait créer.
        actions={
          <>
            {/* CORRIGER LE PARC PASSE DERRIÈRE LES TROIS POINTS. On règle le
                nom, le pays et la devise d'un parc une fois — deux, le jour où
                l'on s'aperçoit qu'il est né dans la mauvaise unité. Ajouter un
                immeuble ou un logement, en revanche, est le geste de tous les
                jours de cet écran. */}
            <Button variant="secondary" icon="plus" onClick={() => setAjoutOuvert(true)}>
              {t('app.portfolio.addBuildingTitle')}
            </Button>
            <Button icon="plus" onClick={() => setLogementOuvert(true)}>
              {t('app.portfolio.addUnitTitle')}
            </Button>
          </>
        }
        debordement={
          /* LE MENU NE DÉPEND PLUS DU RÔLE, mais de ce qu'il contient. Il
             n'avait qu'une entrée, réservée au propriétaire : un gestionnaire
             n'avait donc AUCUN menu sur cet écran, seul cas du produit. La
             correction du parc reste la sienne — elle règle la devise, donc
             l'unité de tous les montants —, l'export est de tout le monde. */
          <MenuDeDebordement libelle={t('common.moreActions')}>
            {peutCorrigerLeParc && (
              <MenuElement icone="globe" onClick={() => setCorrectionOuverte(true)}>
                {t('app.parkSettings.open')}
              </MenuElement>
            )}
            <MenuElement icone="download" onClick={exporterLeParc}>
              {t('app.portfolio.exportPark')}
            </MenuElement>
          </MenuDeDebordement>
        }
      />

      {ajoutOuvert && <AddBuildingModal open onClose={() => setAjoutOuvert(false)} />}

      {correctionOuverte && (
        <ParkSettingsModal open onClose={() => setCorrectionOuverte(false)} />
      )}

      {/* Une confirmation AVANT une suppression définitive : c'est le seul
          geste de cet écran qu'on ne peut pas défaire. */}
      {aSupprimer && (
        <Modal
          open
          onClose={() => setASupprimer(null)}
          title={t('app.portfolio.deleteBuildingTitle', { name: aSupprimer.name })}
          description={t('app.portfolio.deleteBuildingBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setASupprimer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  removeBuilding(aSupprimer.id)
                  setASupprimer(null)
                  notify(t('app.portfolio.deleteBuildingDone'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-body text-muted">{aSupprimer.district}</p>
        </Modal>
      )}
      {logementOuvert && <AddUnitModal open onClose={() => setLogementOuvert(false)} />}

      {immeubleACorriger && (
        <EditBuildingModal
          immeuble={immeubleACorriger}
          onClose={() => setImmeubleACorriger(null)}
        />
      )}
      {logementACorriger && (
        <EditUnitModal unit={logementACorriger} onClose={() => setLogementACorriger(null)} />
      )}

      {/* LE TAUX DU PARC EST UN AGRÉGAT : IL SORT DE LA GRILLE.

          Il y était la QUATRIÈME tuile, dans la même grille que les trois
          immeubles qui le composent — même fond, même bordure, même graisse.
          Un tout rangé parmi ses parties se lit comme une partie de plus : sur
          trois immeubles il passait pour un quatrième, et rien dans la mise en
          page ne disait qu'il les résumait.

          Seul, en bandeau au-dessus de la liste, il redevient ce qu'il est —
          la mesure de l'écran — et la liste en dessous en devient le détail.

          IL RESTE UNE `StatCard` et non un bandeau écrit à la main : elle porte
          `data-indicateur`, `data-valeur`, l'intitulé et la note que six gardes
          savent lire. Un bandeau maison serait invisible à toutes.

          PAS D'INDICATEUR SUR UN PARC SANS LOGEMENT : « 0 % · 0/0 occupées »
          au-dessus de « Aucun logement pour l'instant » est exact, ne dit rien,
          et occupe 140 px avant le message qui, lui, dit tout. */}
      {units.length === 0 || !enTableau ? null : (
        /* SEUL DANS LE GABARIT DES TROIS, et non étiré sur toute la largeur.

           C'est la doctrine que `GRILLE_DEUX_INDICATEURS` a déjà écrite pour ce
           cas exact : « une carte a une taille dans ce produit ; elle ne
           l'emprunte pas à ses voisines ». Étirée, elle porterait deux cents
           pixels de contenu dans une boîte de mille — le défaut que la règle du
           BLANC IMPOSÉ de `mesure-ui` mesure, et qu'`Access.tsx` s'est déjà payé
           à 71 % de vide. La colonne restée libre à sa droite est le prix, et
           c'est un blanc RÉGULIER. */
        <div className={GRILLE_TROIS_INDICATEURS}>
        <StatCard
          icone="gauge"
          label={t('app.dashboard.occupancy')}
          value={`${tauxDe(occupied, units.length)}`}
          unit="%"
          /* LE COMPTAGE BRUT SOUS LE POURCENTAGE : sur douze logements, « 83 % »
             seul cacherait les deux à relouer. */
          note={t('app.portfolio.occupancy', { occupied, total: units.length })}
          bas={
            <div className="mt-3">
              <ProgressBar
                value={tauxDe(occupied, units.length)}
                label={t('app.portfolio.occupancy', { occupied, total: units.length })}
                hideLabel
                hideValue
              />
            </div>
          }
        />
        </div>
      )}

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            icon="search"
            type="search"
            /*
              LE NOM RESTE ENTIER, LE GABARIT RACCOURCIT.

              « Rechercher un logement, un locataire… » était coupé de 55 px à
              320 px : le champ n'offre que 228 px une fois l'icône et les
              rembourrages retirés. Un gabarit tronqué ne se voit pas — rien ne
              déborde, la page ne défile pas — et c'est la sonde du rognage de
              valeur qui l'a relevé, la seule à mesurer le TEXTE plutôt que la
              boîte.

              Le nom accessible garde la phrase entière : c'est lui qu'un
              lecteur d'écran annonce, et il n'a pas de largeur. Ce qui rétrécit
              est ce qui s'affiche, où deux mots suffisent à dire sur quoi
              porte la recherche.
            */
            aria-label={t('nav.searchPlaceholder')}
            placeholder={t('nav.searchShort')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

      </div>

      <DataTable<Unit>
        caption={t('app.portfolio.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        fiches
        /**
         * GROUPÉ PAR IMMEUBLE, ET SEULEMENT EN FICHES.
         *
         * Mesuré à 375 px avant ce lot : « Bonamoussadi » écrit DOUZE fois pour
         * trois immeubles — une grande carte, un bouton de filtre, et une ligne
         * de 43 px sur chacune des douze fiches. L'en-tête de groupe le dit une
         * fois, et la ligne quitte les cartes.
         *
         * PAR IDENTIFIANT ET NON PAR NOM : deux immeubles peuvent s'appeler
         * pareil — la route de suppression le dit en toutes lettres, « deux
         * "Résidence du Mandat" peuvent coexister » — et grouper par le nom les
         * fondrait en un seul bloc.
         */
        groupePar={{
          colonne: 'building',
          cle: (unit) => unit.buildingId,
          /* TOUS LES IMMEUBLES, y compris ceux sans logement : c'est le seul
             endroit d'où l'on peut encore les corriger ou les retirer une fois
             les cartes parties. `modales` l'a refusé avant moi. */
          ordre: ordreDesImmeubles,
          nom: (id) => buildingById(id)?.name ?? '',
          enTete: (id, _lignes, forme) => {
            const b = buildingById(id)
            const { occupied: occ, total } = occupancyOf(id)
            const auTableau = forme === 'tableau'
            const vide = total === 0
            const replie = replies.has(id)
            return (
              /* `data-groupe` : les gardes lisent l'en-tête par cet attribut et
                 non par `role="group"` — d'autres groupes portent ce rôle sur
                 cet écran. Même idiome que `data-indicateur` sur `StatCard`. */
              <div
                data-groupe=""
                className={cn(
                  'px-4 py-3',
                  /* LA BANDE DE PIED DES IMMEUBLES SANS LOGEMENT — reprise du
                     tableau `inline-analytics-table` (ruixen.ui), dont la rangée
                     « Total » clôt la liste sur un fond sourd au lieu de s'y
                     fondre.

                     Ils sont déjà rangés en fin de liste ; la teinte dit qu'ils
                     ferment la liste plutôt qu'ils ne la continuent. C'est ce
                     qu'aucun état vide de 21st ne savait faire : les quatorze
                     que le catalogue propose sont des blocs centrés pleine page,
                     avec icône, titre et bouton — une manière de dire « il n'y a
                     rien ICI », quand ce qu'il faut dire est « la liste s'arrête
                     là, et voilà ce qui reste à remplir ».

                     Pas de `text-muted` sur le bloc entier : le nom de
                     l'immeuble et ses gestes restent au contraste plein. C'est
                     un immeuble qu'on doit encore pouvoir corriger et retirer,
                     pas une note de bas de page. */
                  vide ? 'bg-surface-sunken' : 'bg-surface-2',
                  /* EN FICHES l'en-tête est une CARTE posée sur le fond de la
                     page : il lui faut sa bordure et ses coins. AU TABLEAU il
                     occupe une rangée entre deux filets, dans une boîte qui a
                     déjà les siens — l'y peindre ferait une carte dans une
                     carte, avec deux bordures à trois pixels l'une de l'autre. */
                  !auTableau && 'rounded-lg border border-divider',
                )}
              >
                <div
                  className={cn(
                    'flex gap-3',
                    /* UNE SEULE LIGNE AU TABLEAU, EMPILÉ EN FICHES.

                       Premier jet : la même mise en page des deux côtés. À 1280
                       la rangée de groupe fait 570 px de large, et la barre s'y
                       étirait sur toute la longueur — un trait bleu plein qui se
                       lit comme un SÉPARATEUR et non comme une mesure, pendant
                       que le rapport « 5/5 » partait à l'autre bout de l'écran,
                       à 400 px du nom qu'il qualifie.

                       Au tableau, tout tient donc sur une ligne et la barre est
                       BORNÉE, posée contre son rapport. En fiches la boîte fait
                       moins de 320 px : rien n'y tient sur une ligne, et la
                       barre pleine largeur y est juste. */
                    auTableau ? 'items-center' : 'flex-col',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    {/* LE CHEVRON AVANT LE LIBELLÉ, et une COLONNE de chevrons.

                        Un immeuble VIDE n'en porte pas : il n'a aucune ligne à
                        replier, et un chevron qui ne plie rien est une promesse
                        fausse. Sa place est tenue par un vide de même largeur,
                        pour que les noms des immeubles pleins et vides restent
                        sur le même axe — la colonne survit à l'absence.

                        Le TITRE est le déclencheur, pas une zone à côté de lui :
                        c'est le motif d'accordéon accessible, `<h3><button
                        aria-expanded>`. Les gestes de correction et de retrait
                        restent HORS de ce bouton — un bouton dans un bouton
                        n'est pas du HTML valide, et ils ne replient rien. */}
                    {vide ? (
                      <span aria-hidden="true" className="size-11 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        aria-expanded={!replie}
                        aria-label={
                          replie
                            ? t('app.portfolio.expandBuilding', { name: b?.name ?? '' })
                            : t('app.portfolio.collapseBuilding', { name: b?.name ?? '' })
                        }
                        onClick={() => basculerLeRepli(id)}
                        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
                      >
                        <Icon
                          name="chevronRight"
                          size={15}
                          /* LE MÊME GLYPHE QUI TOURNE, et non deux glyphes.
                             Un chevron qui pivote garde son identité d'un état à
                             l'autre — deux dessins différents se lisent comme
                             deux commandes différentes. `motion-safe` : la
                             rotation ne s'anime que si le lecteur l'accepte. */
                          className={cn(
                            'motion-safe:transition-transform motion-safe:duration-150',
                            !replie && 'rotate-90',
                          )}
                        />
                      </button>
                    )}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-tint text-neutral">
                      <Icon name="building" size={15} />
                    </span>
                    <div className="min-w-0">
                      {/* LE NOM PORTE LE RANG DE TITRE, et c'est ce que la carte
                          ne pouvait pas faire : un intitulé de `StatCard` est un
                          `<p>`. Groupée, la liste devient une STRUCTURE, et un
                          lecteur d'écran doit pouvoir sauter d'immeuble en
                          immeuble par les titres. */}
                      {/* AUCUNE COUPE : `truncate` donnait « Résidence Bonamo… »
                          à 375 px, `line-clamp-2` a coupé 282 px sur 70 offerts.
                          La carte clampait parce qu'une grille doit aligner
                          quatre tuiles ; un en-tête de groupe n'aligne rien. */}
                      <h3 className="font-medium text-ink hyphens-auto break-words">
                        {b?.name}
                      </h3>
                      <p className="text-body text-muted">
                        {b?.district}
                        {/* CE QUE LE « 0/0 » NE DIT PAS. Le rapport est exact et
                            muet : il faut savoir le lire pour comprendre qu'il
                            n'y a pas encore de logement, là où la phrase le dit.
                            C'est la seule chose que la bande de pied ajoute au
                            texte — le reste, elle le dit en teinte. */}
                        {vide ? ` · ${t('app.portfolio.buildingEmpty')}` : ''}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'flex shrink-0 items-center gap-3',
                      !auTableau && 'w-full justify-between',
                    )}
                  >
                    <span className="numeric font-medium">{`${occ}/${total}`}</span>
                    {/* LA BARRE CONTRE SON RAPPORT au tableau — 96 px, la
                        largeur d'une mesure, pas d'un séparateur. Elle SITUE
                        l'immeuble qu'on lit ; elle ne compare plus rien puisque
                        les en-têtes ne s'alignent pas comme s'alignait la
                        grille de cartes. `hideValue` : le rapport est écrit en
                        chiffres à trois pixels de là. */}
                    {auTableau ? (
                      <div className="w-24">
                        <ProgressBar
                          value={tauxDe(occ, total)}
                          label={t('app.portfolio.occupancy', { occupied: occ, total })}
                          hideLabel
                          hideValue
                        />
                      </div>
                    ) : null}
                    {/* LES DEUX MÊMES ISSUES QUE LA CARTE, aux mêmes conditions :
                        corriger toujours, supprimer seulement sur un immeuble
                        VIDE. Le geste ne change pas parce que la mise en page
                        change — c'est la même décision, rendue ailleurs. */}
                    <div className="-my-1.5 flex shrink-0 items-center">
                      <button
                        type="button"
                        aria-label={t('app.portfolio.editBuilding', { name: b?.name ?? '' })}
                        onClick={() => b && setImmeubleACorriger(b)}
                        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
                      >
                        <Icon name="sliders" size={15} />
                      </button>
                      {/* LE GESTE FERMÉ SE MONTRE, ET DIT POURQUOI.

                          Il n'apparaissait que sur un immeuble VIDE. Sur tous
                          les autres il n'y avait RIEN — ni bouton, ni raison :
                          deux immeubles voisins offraient des gestes différents
                          et l'écran n'en donnait pas le motif. On cherche alors
                          le bouton manquant, puis ce qu'on a mal fait.

                          `aria-disabled` ET NON `disabled` : un bouton désactivé
                          sort de l'ordre de tabulation, donc sa raison devient
                          inatteignable au clavier — précisément pour qui en a le
                          plus besoin. Il reste focalisable, annonce son état, et
                          son nom accessible PORTE le motif avec le compte qui dit
                          quoi faire pour l'ouvrir.

                          Il garde ses 44 px : une cible fermée reste une cible,
                          et la rétrécir la mettrait sous le plancher que
                          `mesure-ui` tient sur soixante-treize autres commandes. */}
                      {b ? (
                        <button
                          type="button"
                          aria-disabled={total > 0 || undefined}
                          aria-label={
                            total === 0
                              ? t('app.portfolio.deleteBuilding', { name: b.name })
                              : t('app.portfolio.deleteBuildingBlocked', {
                                  name: b.name,
                                  count: total,
                                })
                          }
                          onClick={total === 0 ? () => setASupprimer(b) : undefined}
                          className={cn(
                            'inline-flex size-11 shrink-0 items-center justify-center rounded-md',
                            total === 0
                              ? 'cursor-pointer text-muted hover:bg-danger-tint hover:text-danger'
                              : /* `opacity-45` est l'ÉTEINT que `Button` applique à
                                   toutes ses commandes fermées — repris ici plutôt
                                   qu'un gris choisi pour l'occasion, pour qu'un geste
                                   fermé ait la même mine partout. Sans son
                                   `pointer-events-none` : on veut justement que le
                                   curseur réponde et dise « fermé ». Le glyphe est
                                   `aria-hidden`, donc rien de ce qui s'atténue ne
                                   porte d'information — le nom accessible la porte. */
                                'cursor-not-allowed text-muted opacity-45',
                          )}
                        >
                          <Icon name="close" size={15} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {/* EN FICHES SEULEMENT : la boîte fait moins de 320 px, la barre
                    y prend toute la largeur sous le nom, où elle situe
                    l'immeuble qu'on est en train de lire. */}
                {auTableau ? null : (
                  <div className="mt-2">
                    <ProgressBar
                      value={tauxDe(occ, total)}
                      label={t('app.portfolio.occupancy', { occupied: occ, total })}
                      hideLabel
                      hideValue
                    />
                  </div>
                )}
              </div>
            )
          },
        }}
        empty={
          /* Deux absences, deux messages. Un parc sans aucun logement n'a pas
             « échoué à trouver » : il n'a rien à trouver. L'écran annonçait
             pourtant « Aucune unité ne correspond à «  » » — la requête vide
             entre ses guillemets — et proposait de réinitialiser des filtres
             qu'on n'avait pas posés. C'est le premier écran d'un compte neuf. */
          units.length === 0 ? (
            /* Sans bouton : « Ajouter un immeuble » est déjà dans l'en-tête,
               à trois centimètres au-dessus. Le répéter donnait deux actions
               principales identiques sur le même écran — un doublon que la
               synthèse vocale annonce deux fois, et qui fait hésiter sur
               laquelle est la bonne. Le texte dit le geste, l'en-tête le
               porte. */
            <EmptyState
              icon="building"
              level={2}
              /*
                DEUX VIDES, ET UN SEUL APPELLE UN GESTE.

                Le parc du propriétaire est vraiment vide, et le remplir est
                vraiment son geste. Le gestionnaire borné, lui, regarde un parc
                qui compte peut-être trois immeubles — on a seulement omis de
                lui en confier un. Le texte générique lui prescrivait de
                DÉCLARER un immeuble, bouton à l'appui : le produit l'invitait
                à dédoubler le parc de son client.
              */
              title={t(scoped ? 'app.portfolio.emptyScopedTitle' : 'app.portfolio.emptyTitle')}
              body={t(scoped ? 'app.portfolio.emptyScopedBody' : 'app.portfolio.emptyBody')}
            />
          ) : (
          <EmptyState
            level={2}
            title={t('app.portfolio.searchEmpty', { query })}
            body={t('app.portfolio.searchEmptyHint')}
            // Ce bouton réutilisait la clé du filtre, donc il s'appelait
            // « Tous » / « All » : le libellé d'un filtre, pas d'une action.
            // Il réinitialise la recherche ET l'immeuble — il le dit.
            action={
              <Button variant="secondary" onClick={() => setQuery('')}>
                {t('app.portfolio.resetFilters')}
              </Button>
            }
          />
          )
        }
        columns={[
          {
            key: 'unit',
            role: 'identite',
            header: t('app.portfolio.unit'),
            width: '5.5rem',
            /**
             * UN LIEN DANS LA CELLULE, et non une ligne cliquable.
             *
             * C'est la voie que `DataTable` avait laissée ouverte, en toutes
             * lettres : « le jour où une ligne devra mener quelque part, la
             * réponse juste sera un vrai lien dans une cellule — focalisable,
             * ouvrable dans un nouvel onglet, annoncé par sa destination — et
             * non une rangée piégée ». Ce jour est arrivé avec le dossier du
             * logement.
             *
             * Le nom accessible porte le libellé de l'unité : « A1 » seul, dans
             * une liste de dix liens, ne dit pas où l'on va.
             */
            render: (unit) => (
              <Link
                to={lien(base, `parc/${unit.id}`)}
                // Porte l'adresse d'où l'on part — voir le commentaire sur
                // `location` en tête de composant. Le dossier n'en fait rien
                // s'il est ouvert autrement, une adresse tapée directement.
                state={{ from: `${location.pathname}${location.search}` }}
                aria-label={t('app.unitFile.open', { unit: unit.label })}
                /*
                  LA CIBLE FAIT LA CELLULE, SANS DÉPLACER UN PIXEL.

                  Mesuré dans un navigateur : ce lien faisait 18 × 17 px. C'est
                  la SEULE entrée vers le dossier d'un logement — la rangée n'est
                  pas cliquable, et ce fichier explique pourquoi elle ne doit pas
                  l'être — alors que le dépôt s'est donné un plancher de 44 px,
                  honoré par soixante-treize autres commandes. Viser « A1 » entre
                  neuf voisins, sur un téléphone d'entrée de gamme, demande une
                  précision que personne n'a.

                  `min-h-11` sur le lien aurait marché et coûté cher : mesuré, il
                  portait la rangée de 47 à 69 px et le tableau de 613 à 868 px
                  sur mobile, où la colonne « Immeuble » est masquée et
                  n'absorbe donc rien. `::after` étendu sur la cellule — qui fait
                  déjà 47 px de haut — donne une cible PLUS grande pour zéro
                  déplacement.
                */
                className="numeric font-medium text-ink underline-offset-4 after:absolute after:inset-0 hover:underline"
              >
                {unit.label}
              </Link>
            ),
          },
          {
            key: 'building',
            /**
             * LE NOM DE L'IMMEUBLE, sous un en-tête qui dit « Immeuble ».
             *
             * La cellule rendait le QUARTIER. La vignette du haut, elle, rend le
             * nom : « Résidence Djoumessi » en carte et « Bastos » en ligne
             * désignaient le même bâtiment sans que rien ne le dise, et deux
             * résidences d'un même quartier étaient indiscernables dans le
             * tableau. Le quartier reste, en second, parce qu'il situe — mais
             * il ne tient plus la place du nom.
             */
            header: t('app.portfolio.building'),
            hideOnMobile: true,
            render: (unit) => {
              const immeuble = buildingById(unit.buildingId)
              return (
                <div className="flex flex-col">
                  <span>{immeuble?.name}</span>
                  <span className="text-body text-muted">{immeuble?.district}</span>
                </div>
              )
            },
          },
          {
            key: 'type',
            // La colonne s'intitulait « Type » mais ses cellules portent la
            // typologie ET la surface : un lecteur d'écran annonçait « Type »
            // sur « T3 · 78 m² ». La clé `surface` existait, inutilisée.
            header: `${t('app.portfolio.type')} · ${t('app.portfolio.surface')}`,
            hideOnMobile: true,
            render: (unit) => (
              <span className="text-muted">
                {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
              </span>
            ),
          },
          {
            key: 'tenant',
            header: t('app.portfolio.tenant'),
            render: (unit) =>
              unit.tenant ?? <span className="text-muted italic">{t('app.portfolio.noTenant')}</span>,
          },
          {
            key: 'rent',
            role: 'valeur',
            header: t('app.portfolio.rent'),
            numeric: true,
            render: (unit) => money(unit.rent, { compact: true }),
          },
          {
            /**
             * L'OCCUPATION, SORTIE DE LA COLONNE DE PAIEMENT.
             *
             * `PaymentStatus` compte cinq valeurs, et la cinquième n'est pas de
             * la même nature que les quatre autres : `paid`, `partial`,
             * `overdue` et `uncalled` disent ce qu'un bail a fait de son
             * échéance ; `vacant` dit qu'il n'y a pas de bail. Un logement vide
             * n'est pas en défaut de paiement — il n'a rien à payer — et les
             * rendre dans la même colonne les faisait compter ensemble.
             *
             * CE QUE ÇA COÛTAIT À L'ÉCRAN : le taux d'occupation que la rangée
             * du haut annonce ne se retrouvait par AUCUN décompte de la table.
             * Il fallait savoir que « Vacant » ne rentre pas dans le même total
             * que « Payé » pour compter dix logements loués sur douze lignes.
             *
             * PAS DE `hideOnMobile` : l'occupation est ce que cet écran mesure.
             * Le quartier et la typologie se replient sur un téléphone parce
             * qu'ils SITUENT ; celle-ci est la mesure elle-même.
             */
            key: 'occupation',
            role: 'etat',
            header: t('app.portfolio.occupation'),
            render: (unit) => (
              /* LE MÊME TON DES DEUX CÔTÉS, et c'est `occupationSansVerdict`
                 porté à la ligne : un logement loué n'est pas un succès, un
                 logement vide n'est pas une alerte. `PAYMENT_TONES` associe déjà
                 `vacant` à `neutral` en toutes lettres — « rien n'a été appelé,
                 donc rien n'est en défaut ». La pastille distingue donc par son
                 MOT, jamais par sa teinte, ce qui est aussi ce que
                 `couleur-non-seule` exige. */
              <StatusPill
                tone="neutral"
                /* LE GLYPHE SÉPARE CE QUE LE TON REFUSE DE SÉPARER.

                   Les deux pastilles partagent `neutral` exprès — un logement
                   loué n'est pas un succès, un logement vide n'est pas une
                   alerte — mais elles héritaient alors du MÊME glyphe `info`,
                   et la colonne entière se lisait comme une suite de pastilles
                   identiques dont seul le mot changeait.

                   `users` : il y a quelqu'un. `key` : on tient les clés, il faut
                   relouer — le même glyphe que la pastille de paiement d'une
                   vacance, parce que c'est la même chose qui est dite. */
                icon={unit.status === 'vacant' ? 'key' : 'users'}
                size="sm"
              >
                {unit.status === 'vacant' ? t('status.vacant') : t('app.portfolio.occupied')}
              </StatusPill>
            ),
          },
          {
            key: 'status',
            role: 'etat',
            header: t('app.tenants.rentStatus'),
            render: (unit) =>
              unit.status === 'vacant' ? (
                /* UN TIRET, PAS UNE PASTILLE. Peindre « rien à percevoir » en
                   pastille rendrait à l'absence le poids d'un état, et remettrait
                   dans cette colonne ce que la colonne d'à côté vient d'en
                   sortir. La cellule est muette parce qu'il n'y a rien à dire.

                   `aria-hidden` sur le tiret et le motif en `sr-only` : un tiret
                   cadratin s'annonce « tiret » ou ne s'annonce pas, et douze
                   cellules silencieuses à la synthèse vocale ne diraient pas
                   POURQUOI elles le sont. */
                <>
                  <span aria-hidden="true" className="text-muted">
                    —
                  </span>
                  <span className="sr-only">{t('app.portfolio.nothingDue')}</span>
                </>
              ) : (
                <PaymentStatusPill status={unit.status} size="sm" />
              ),
          },
          {
            key: 'geste',
            /* UNE SEULE COLONNE DE GESTES, et ce n'est pas un choix d'esthétique :
               `DataTable` ÉPINGLE toute colonne `role: 'geste'` en `sticky
               right-0`. Deux colonnes de ce rôle se recouvrent — mesuré cette
               semaine sur l'écran des locataires, où « Corriger » rendait
               « Corı ». */
            role: 'geste',
            header: '',
            render: (unit) => (
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="sliders"
                  /* LE NUMÉRO DANS LE NOM ACCESSIBLE : douze boutons « Corriger »
                     à la suite ne disent pas lequel on active, et c'est ce que la
                     synthèse vocale annonce ligne après ligne. */
                  aria-label={t('app.portfolio.editUnit', { unit: unit.label })}
                  onClick={() => setLogementACorriger(unit)}
                >
                  {t('app.tenants.edit')}
                </Button>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}

/**
 * Le parc, le temps qu'il arrive.
 *
 * Titre et sous-titre restent : ils sont écrits en dur, aucune donnée ne les
 * décide. Les deux actions, elles, sont retenues — « ajouter un logement »
 * ouvre une modale qui fait choisir un immeuble, et les seuls immeubles connus
 * à cet instant sont ceux de la démonstration. Le geste partirait au serveur
 * avec l'identifiant d'un immeuble qui n'existe pas chez lui.
 *
 * La recherche et les filtres sont retenus pour la même raison : filtrer un
 * parc qu'on n'a pas encore n'a pas de sens, et un champ de recherche actif
 * pendant l'attente invite à taper pour ne rien trouver.
 */
function PortfolioSkeleton() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('app.portfolio.title')}
        /* Le sous-titre porte désormais les comptes réels : pendant l'attente
           on ne les connaît pas, et en inventer — ne serait-ce que zéro —
           annoncerait un parc vide à qui en a un. Un pavé tient la place. */
        description={<Skeleton line="body" className="w-full max-w-md" />}
        actions={
          <>
            <Skeleton radius="md" className="h-11 w-48" />
            <Skeleton radius="md" className="h-11 w-44" />
          </>
        }
      />

      <SkeletonRegion>
        {/* Quatre cartes : le nombre réel vaut « un par immeuble, plus le
            total », donc il dépend du parc qu'on attend. Quatre remplit
            exactement une rangée de la grille sur grand écran. */}
        {/* UN, ET NON QUATRE. Le squelette annonçait la grille des trois
            immeubles plus le taux ; l'écran charge désormais le seul bandeau
            d'occupation. Un squelette qui promet quatre cartes et en rend une
            fait sauter la page au chargement — et c'est le défaut exact que
            `SkeletonStatRow` documente, « attendait sous quatre cartes égales
            et chargeait trois cartes inégales ». */}
        <SkeletonStatRow count={1} className={GRILLE_TROIS_INDICATEURS} />

        <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <Skeleton radius="md" className="h-11 w-full max-w-xs" />
          {[0, 1, 2].map((filtre) => (
            <Skeleton key={filtre} radius="md" className="h-11 w-24" />
          ))}
        </div>

        <SkeletonTable />
      </SkeletonRegion>
    </>
  )
}
