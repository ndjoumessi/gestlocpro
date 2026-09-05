import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
import { GRILLE_QUATRE_INDICATEURS } from './grillesDIndicateurs'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Modal } from '@/components/primitives/Modal'
import { Icon } from '@/components/primitives/Icon'
import { useToast } from '@/components/primitives/Toast'
import type { Immeuble } from '@/data/apiPortfolio'
import { GroupeDeFiltres } from '@/components/controls/GroupeDeFiltres'
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

  /*
    LE FILTRE D'IMMEUBLE VIT DANS L'URL, la recherche non.

    Il vivait en mémoire : ouvrir le dossier d'un logement puis revenir rendait
    le parc entier, filtre perdu. Sur un parc de trois immeubles c'est agaçant ;
    sur douze, c'est un geste à refaire à chaque aller-retour, et l'aller-retour
    est précisément ce que cet écran sert à faire.

    La RECHERCHE, elle, reste locale, et ce n'est pas une inconséquence. Un
    filtre d'immeuble désigne une portion stable du parc — il se partage, se met
    en favori, se retrouve. Une frappe en cours de saisie est personnelle et
    éphémère : la pousser dans l'URL écrirait une entrée d'historique par
    caractère.

    `replace` et non `push` : choisir un immeuble n'est pas une navigation, et
    le bouton « retour » doit ramener à l'écran précédent, jamais dérouler à
    l'envers la liste des filtres qu'on a essayés.
  */
  const [parametres, setParametres] = useSearchParams()
  const building = parametres.get('immeuble') ?? 'all'
  const setBuilding = (valeur: string | 'all') => {
    const suite = new URLSearchParams(parametres)
    if (valeur === 'all') suite.delete('immeuble')
    else suite.set('immeuble', valeur)
    setParametres(suite, { replace: true })
  }

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return units.filter((unit) => {
      if (building !== 'all' && unit.buildingId !== building) return false
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
  }, [query, building, units, t, buildingById])

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
  const tauxDe = (occupees: number, total: number) =>
    total === 0 ? 0 : Math.round((occupees / total) * 100)

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

      {/* PAS D'INDICATEUR SUR UN PARC SANS LOGEMENT.

          « Taux d'occupation 0 % · 0/0 occupées » au-dessus de « Aucun logement
          pour l'instant » : le chiffre est exact, il ne dit rien, et il occupe
          140 px avant le message qui, lui, dit tout. Mesuré par
          `espace-connecte` sur son parc vide, aux trois largeurs et dans les
          deux langues.

          La division était déjà gardée ici — « un parc vide donne 0 % et non
          NaN ». Ce lot va d'un cran plus loin : sur un parc vide, la carte
          elle-même n'a pas lieu d'être. */}
      {BUILDINGS.length === 0 ? null : (
      <div className={GRILLE_QUATRE_INDICATEURS}>
        {BUILDINGS.map((b) => {
          const { occupied: occ, total } = occupancyOf(b.id)
          return (
            <StatCard
              key={b.id}
              /* Le seul endroit du produit où une carte désigne un immeuble
                 RÉEL : le glyphe y est donc l'immeuble. Ailleurs, un chiffre
                 d'occupation prend le cadran. */
              icone="building"
              /* Le NOM et non le quartier : la carte parle d'un immeuble, et
                 deux immeubles d'un même quartier donnaient deux cartes
                 intitulées « BASTOS ». Le quartier passe en note, où il situe
                 sans prétendre nommer. */
              label={b.name}
              /* Le seul intitulé de carte du produit qui porte une DONNÉE,
                 avec celui de la vitrine des états : un nom d'immeuble n'a pas
                 de longueur maximale, donc il se coupe, et la garde du rognage
                 sait que cette coupe-là est assumée. */
              donnee
              value={`${occ}/${total}`}
              /* LA NOTE A RENDU LE RAPPORT À LA BARRE.
                 Elle valait « Bonamoussadi · 5/5 occupées », quinze pixels sous
                 un « 5/5 » en gros caractères : le même rapport deux fois dans
                 une carte de quatre lignes, sur la ligne exacte où la barre
                 devait aller. Le quartier reste — lui SITUE l'immeuble et ne se
                 répète nulle part ailleurs sur la carte. Le rapport, lui, est
                 désormais dit une fois en chiffres et une fois en longueur. */
              note={b.district}
              bas={
                /* LA BARRE, PARCE QUE TROIS RAPPORTS À DÉNOMINATEURS DIFFÉRENTS
                   NE SE COMPARENT PAS.

                   « 5/5 », « 3/4 », « 2/3 » : trois divisions à poser de tête
                   pour savoir lequel des trois immeubles est le plus troué, et
                   l'ordre de la rangée n'est PAS l'ordre de tension — 100, 75,
                   67. La grille aligne les cartes, donc les barres partagent
                   origine et longueur : le classement se lit en travers.

                   `hideValue` : la carte porte déjà « 5/5 » en gros. Le
                   pourcentage à droite de la piste écrirait une troisième fois
                   ce que la tuile vient de perdre en doublon.

                   AUCUN TON AU SEUIL, et c'est délibéré. `occupationSansVerdict`
                   a tranché pour la carte du tableau de bord : un ratio
                   d'occupation n'est ni `ok`, ni `warn`, ni `danger`, sous peine
                   d'une alerte allumée à perpétuité sur chaque immeuble. Peindre
                   la barre au seuil rouvrirait ici ce que ce cas ferme là-bas. */
                <div className="mt-3">
                  <ProgressBar
                    value={tauxDe(occ, total)}
                    label={t('app.portfolio.occupancy', { occupied: occ, total })}
                    hideLabel
                    hideValue
                  />
                </div>
              }
              action={
                /* DEUX ISSUES, ET UNE SEULE EST CONDITIONNELLE.

                   La suppression n'apparaît que sur un immeuble VIDE — le
                   serveur refuse les autres, et offrir un geste qu'il refusera
                   revient à promettre ce qu'on ne tient pas.

                   LA CORRECTION, ELLE, EST TOUJOURS LÀ. Renommer n'emporte ni
                   bail ni somme, et c'est précisément sur un immeuble PLEIN
                   qu'elle sert : jusqu'à ce lot, une faute de frappe devenait
                   définitive dès le premier logement, la suppression étant le
                   seul chemin et se refusant à partir de là. */
                /* `-my-1.5` SEUL, ET PAS `-mr-1.5`.

                   Le retrait vertical empêche une cible de 44 px de grandir la
                   rangée d'en-tête ; le retrait HORIZONTAL, lui, poussait le
                   bouton de 6 px hors de sa boîte — mesuré par la règle du
                   débordement local, 72 occurrences sur `/demo/parc`. Il
                   existait déjà sur le bouton de suppression, mais aucune carte
                   de la démonstration n'est VIDE : la règle ne l'avait jamais
                   rencontré. Le rendre inconditionnel l'a exposé.

                   Ce qu'il achetait : 6 px d'alignement optique du glyphe sur le
                   bord de la carte. Ce qu'il coûtait : une forme qui sort de son
                   conteneur, donc une tolérance à inscrire sur la signature d'un
                   en-tête de carte QUE TOUT LE PRODUIT PARTAGE. On paie
                   l'alignement, pas le blanc-seing. */
                <div className="-my-1.5 flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label={t('app.portfolio.editBuilding', { name: b.name })}
                    onClick={() => setImmeubleACorriger(b)}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon name="sliders" size={15} />
                  </button>
                  {total === 0 ? (
                    <button
                      type="button"
                      aria-label={t('app.portfolio.deleteBuilding', { name: b.name })}
                      onClick={() => setASupprimer(b)}
                      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-danger-tint hover:text-danger"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  ) : null}
                </div>
              }
            />
          )
        })}
        {/* LE TAUX D'OCCUPATION PART SEUL, et la nuance a été payée.

            Le premier jet masquait la rangée ENTIÈRE quand `units` était vide.
            Un parc d'un immeuble SANS logement perdait alors sa carte — et avec
            elle le seul bouton qui permette de retirer un immeuble créé par
            faute de frappe, dont l'existence est justifiée à sa route : « toute
            faute de frappe était définitive ». `gestures.test.tsx` l'a refusé,
            et il avait raison.

            La rangée suit donc les IMMEUBLES, et cette carte-ci les LOGEMENTS :
            « 0 % · 0/0 occupées » ne dit rien, une carte d'immeuble dit son nom
            et porte son issue. */}
        {units.length === 0 ? null : (
        <StatCard
          icone="gauge"
          label={t('app.dashboard.occupancy')}
          /* `computeKpis` borne déjà cette division — « un parc vide donne 0 %
             et non NaN » — et ce second calcul, écrit à la main ici, ne le
             faisait pas. Un compte neuf lisait « NaN % » dès l'ouverture de cet
             écran, sur le seul indicateur de la page. La borne vit maintenant
             dans `tauxDe`, que les trois cartes d'immeuble partagent. */
          value={`${tauxDe(occupied, units.length)}`}
          unit="%"
          /* LA NOTE RESTE ICI, à la différence des cartes d'immeuble : « 10/12
             occupées » n'est pas la répétition de « 83 % », c'est le comptage
             BRUT sous le pourcentage. Sur douze logements, le pourcentage seul
             cacherait les deux à relouer. */
          note={t('app.portfolio.occupancy', { occupied, total: units.length })}
          bas={
            /* LA MÊME BARRE QUE SES PARTIES, et c'est le point : la carte du
               parc se lit dans la même rangée que les trois immeubles qui la
               composent. Une échelle commune, ou aucune comparaison. */
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
        )}
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

        <GroupeDeFiltres
          libelle={t('app.portfolio.building')}
          valeur={building}
          onChange={setBuilding}
          /* Le bouton porte le NOM de l'immeuble, qui est ce sur quoi il filtre.
             Il portait le quartier : deux résidences à Bastos auraient donné deux
             boutons identiques, dont l'un aurait été injoignable — l'utilisateur
             aurait cliqué le premier en croyant atteindre le second. */
          options={[{ id: 'all', name: t('app.portfolio.filterAll') }, ...BUILDINGS].map((b) => ({
            valeur: b.id,
            libelle: b.name,
          }))}
        />
      </div>

      <DataTable<Unit>
        caption={t('app.portfolio.title')}
        rows={rows}
        rowKey={(unit) => unit.id}
        fiches
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
              <Button variant="secondary" onClick={() => { setQuery(''); setBuilding('all') }}>
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
              <StatusPill tone="neutral" size="sm">
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
        <SkeletonStatRow count={4} className={GRILLE_QUATRE_INDICATEURS} />

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
