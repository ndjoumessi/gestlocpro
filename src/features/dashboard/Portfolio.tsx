import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRole } from '@/components/layout/AppShell'
import { lien, useBase } from '@/lib/base'
import { DataTable, EmptyState, idDuGroupe } from '@/components/primitives/DataTable'
import { PaymentStatusPill } from '@/components/primitives/StatusPill'
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
import { useDates } from '@/lib/useDates'
import { type Unit } from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { chargerParc } from '@/data/apiPortfolio'
import { useSession } from '@/api/SessionProvider'
import { AddBuildingModal } from './AddBuildingModal'
import { ParkSettingsModal } from './ParkSettingsModal'
import { AddUnitModal } from './AddUnitModal'
import { EditBuildingModal } from './EditBuildingModal'
import { EditUnitModal } from './EditUnitModal'
import { NewTenantModal } from './Tenants'
import { MonthPicker } from '@/components/primitives/DatePicker'
import { Card } from '@/components/primitives/Card'
import { JaugesDePeriode, LegendeDesPostes } from './JaugesDePeriode'
import { Badge } from '@/components/primitives/Badge'

/* La grille des fiches d'un immeuble, NOMMÉE : le squelette l'annonce et
   l'écran chargé la rend, et `squelettesFideles.test.ts` refuse qu'elle soit
   écrite deux fois.

   FLUIDE, ET NON PAR POINTS DE RUPTURE. `grid-cols-2 xl:grid-cols-3` disait
   « deux colonnes » à toute largeur où cette grille est rendue — y compris
   à 320 px, où `espace-connecte` l'a vue déborder de 71 px : la porte
   redimensionne la page sans la recharger, et le rendu de bureau y survit le
   temps d'une mesure. Une colonne de 18 rem au moins, autant qu'il en tient,
   jamais plus large que sa boîte (`min(100%, 18rem)`) : deux à 1024 px, trois
   à 1440, cinq à 1920, une seule si la boîte est étroite — et rien ne
   déborde, quelle que soit la largeur où elle se peint. Seize rem donnaient
   quatre colonnes de 259 px à 1440, mesuré : trop peu pour un nom entier.

   AUCUN ÉCART VERTICAL, ET C'EST CE QUI PERMET D'ALIGNER. Les fiches partagent
   leurs cinq rangées par `subgrid` (voir `SECTIONS_DE_FICHE_LOGEMENT`), dont
   quatre déclarées et remplies par toute fiche. Un écart de grille
   s'ajouterait autour de chaque rangée vide : mesuré dans Chromium, 12 px de
   blanc pour une barre qu'aucune fiche de la rangée ne porte, même avec un
   écart nul déclaré sur la fiche. L'espacement vit donc DANS les sections, et
   les rangées de fiches se séparent par la marge basse de chaque fiche — d'où
   `pb-1` : 4 px plus les 12 de la dernière rangée font les 16 d'avant. */
const GRILLE_DES_FICHES =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-x-3 border-t border-divider px-4 pt-4 pb-1'

/**
 * QUATRE SECTIONS DÉCLARÉES, QUE TOUTE FICHE REMPLIT — en-tête, occupant, type,
 * loyer —, puis une cinquième rangée, la QUEUE, qui porte ce qui varie et ne se
 * déclare pas.
 *
 * Relevé le 2026-09-11 par `MESURER_SECTIONS_ALIGNEES` avant ce lot : à côté d'un
 * logement vide, le type et le loyer des fiches occupées commençaient 25 px plus
 * bas — il leur manquait la ligne « depuis » ; à côté d'un partiel, les jauges
 * du mois 14 px plus haut — il leur manquait la barre. Une grille de fiches se
 * compare par ses lignes : « 145 000 FCFA » en face de « 110 000 FCFA ».
 *
 * UNE RANGÉE QU'UNE SEULE FICHE OCCUPE, TOUTES SES VOISINES LA RÉSERVENT. La
 * barre vit donc sur la ligne des jauges, la date sur celle du type, et les
 * jauges, les faits et le geste tiennent ENSEMBLE dans la queue — voir la fiche.
 * Ce qui reste de place y tombe en bas, sous le contenu, et non au milieu.
 */
const SECTIONS_DE_FICHE_LOGEMENT = 'mb-3 row-span-5 grid grid-rows-subgrid'

/** Le mois voisin, sans jamais passer par un `Date` local — voir la route. */
function moisDecale(mois: string, pas: number) {
  const [an, m] = mois.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(an, m - 1 + pas, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

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
  /* Le logement VACANT qu'on remplit depuis sa fiche : la modale des Locataires,
     ouverte sur ce logement seul. */
  /* L'immeuble VIDE depuis lequel on ajoute un logement — voir son en-tête. */
  const [logementPour, setLogementPour] = useState<string | null>(null)
  const [aAttribuer, setAAttribuer] = useState<Unit | null>(null)
  const idDuVerrouDemo = useId()
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
  const d = useDates()
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const { money } = useCurrency()
  /**
   * LE MOIS AFFICHÉ — la promesse que le sous-titre faisait depuis toujours.
   *
   * « Le statut porte sur le mois affiché », dit-il. Aucun mois ne s'affichait,
   * et aucun ne pouvait se demander : la route rendait la dernière échéance de
   * chaque bail, point. La page nommait une dimension qu'elle ne donnait pas.
   *
   * ═══ DANS L'URL, ET C'EST UN CHOIX RETOURNÉ ═══
   *
   * Le filtre d'immeuble en est SORTI au lot du groupement, parce qu'il y était
   * devenu faux. Le mois, lui, y a sa place pour la raison qui valait pour
   * l'autre : il désigne une vue stable qu'on partage, qu'on met en favori, et
   * qui doit survivre à l'aller-retour vers le dossier d'un logement. La
   * recherche reste locale — une frappe en cours de saisie est éphémère.
   *
   * ═══ L'ÉCRAN, PAS LA SESSION ═══
   *
   * Le tableau de bord et les paiements lisent le même portefeuille. Faire
   * glisser leur mois avec celui-ci changerait le sens de trois écrans d'un
   * seul geste ; le sous-titre ne promet que CELUI-CI. Le parc relit donc pour
   * son compte, et les autres gardent leur vue d'aujourd'hui.
   */
  const [parametres, setParametres] = useSearchParams()
  const moisCourant = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const moisChoisi = parametres.get('mois') ?? moisCourant
  const setMois = (valeur: string) => {
    const suite = new URLSearchParams(parametres)
    if (valeur === moisCourant) suite.delete('mois')
    else suite.set('mois', valeur)
    /* `replace` : changer de mois n'est pas une navigation, et le bouton
       « retour » doit ramener à l'écran précédent — jamais dérouler à l'envers
       la liste des mois qu'on a consultés. Même arbitrage que le filtre
       d'immeuble en son temps. */
    setParametres(suite, { replace: true })
  }

  const { units, buildings: BUILDINGS, buildingById, loading, removeBuilding, removeUnit, scoped } =
    usePortfolio()
  // Les travaux, les cautions et les échéances sont déjà chargés avec le parc :
  // la fiche les dit.
  const { works, deposits, receiptsForUnit } = usePortfolio()

  /**
   * L'ÉCHÉANCE DU MOIS AFFICHÉ, par logement.
   *
   * Le parc lot avait laissé les trois jauges en reste, « parce que le parc
   * ne charge pas les échéances ». Il les chargeait : `chargerParc` est le
   * même appel que Paiements, et `receiptsForUnit` tient l'historique entier
   * du bail — le serveur ne borne au mois que le STATUT, pas l'historique. Un
   * autre mois se lit donc sans nouvel appel, dans ce que le fournisseur
   * porte déjà.
   */
  const periodeAffichee = useMemo(() => {
    const [year, mois] = moisChoisi.split('-').map(Number)
    return { year, month: mois - 1 }
  }, [moisChoisi])
  const echeanceDuMois = (unit: Unit) =>
    receiptsForUnit(unit.id).find(
      (r) => r.year === periodeAffichee.year && r.month === periodeAffichee.month,
    )

  /**
   * LE PARC RELU AU MOIS DEMANDÉ — et seulement quand on en demande un autre.
   *
   * Au mois courant, on lit ce que le fournisseur porte déjà : une seconde
   * requête pour la même réponse serait un aller-retour offert au réseau.
   *
   * SEUL LE RÈGLEMENT CHANGE d'un mois à l'autre : le serveur ne borne que
   * l'échéance retenue, jamais l'existence du bail. Un logement vacant
   * aujourd'hui l'est dans tous les mois de cette vue, donc l'occupation, la
   * barre et le loyer appelé restent justes — on peut servir ces unités-là
   * partout dans l'écran sans les distinguer.
   *
   * `annule` : deux changements de mois rapides lancent deux lectures, et la
   * plus lente pourrait écraser la plus récente. Sans ce drapeau, l'écran
   * afficherait le mois qu'on vient de quitter.
   */
  const [unitesDuMois, setUnitesDuMois] = useState<Unit[] | null>(null)
  const [lectureDuMois, setLectureDuMois] = useState(false)
  const parkId = adhesionActive?.parkId ?? null
  useEffect(() => {
    if (!parkId || moisChoisi === moisCourant) {
      setUnitesDuMois(null)
      setLectureDuMois(false)
      return
    }
    let annule = false
    setLectureDuMois(true)
    void chargerParc(parkId, moisChoisi)
      .then((parc) => {
        if (!annule) setUnitesDuMois(parc.units)
      })
      .catch(() => {
        if (!annule) setUnitesDuMois(null)
      })
      .finally(() => {
        if (!annule) setLectureDuMois(false)
      })
    return () => {
      annule = true
    }
  }, [parkId, moisChoisi, moisCourant])

  const unitesAffichees = unitesDuMois ?? units
  const { notify } = useToast()
  /** L'immeuble dont la suppression attend confirmation. */
  const [aSupprimer, setASupprimer] = useState<Immeuble | null>(null)
  /** Le logement dont le retrait attend confirmation. */
  const [logementASupprimer, setLogementASupprimer] = useState<Unit | null>(null)
  const [query, setQuery] = useState('')



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
    return unitesAffichees.filter((unit) => {
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
  }, [query, unitesAffichees, t, buildingById])

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

  const occupied = unitesAffichees.filter((u) => u.status !== 'vacant').length

  /**
   * L'occupation par immeuble se dérive de l'état vivant.
   *
   * Elle lisait `BUILDINGS`, une constante figée, tandis que la carte globale
   * juste à côté comptait les unités du provider. Rattacher un locataire fait
   * passer une unité de `vacant` à `pending` : le total bougeait, les quatre
   * cartes d'immeuble non. Deux chiffres contradictoires sur la même ligne.
   */
  const occupancyOf = (buildingId: string) => {
    const inBuilding = unitesAffichees.filter((u) => u.buildingId === buildingId)
    return { occupied: inBuilding.filter((u) => u.status !== 'vacant').length, total: inBuilding.length }
  }

  /**
   * CE QUE L'IMMEUBLE APPELLE CE MOIS-CI — la somme des loyers de ses lots
   * OCCUPÉS.
   *
   * Pas le loyer du parc plein : un lot vide n'appelle rien, et l'additionner
   * ferait lire un revenu qui n'existe pas. Ce qu'il coûte de ne pas le louer se
   * lit sur SA ligne, où la colonne Loyer dit « attendu ».
   */
  const loyerDe = (buildingId: string) =>
    unitesAffichees
      .filter((u) => u.buildingId === buildingId && u.status !== 'vacant')
      .reduce((somme, u) => somme + u.rent, 0)

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
  /*
    L'EN-TÊTE D'IMMEUBLE, UNE SEULE FOIS POUR DEUX FORMES.

    Sous `lg`, `DataTable` le rend au-dessus des fiches de chaque groupe ; sur
    bureau, la carte d'immeuble le rend au-dessus de sa grille. Deux copies
    auraient dérivé — c'est le même nom, la même occupation, le même menu.
  */
  const enTeteDImmeuble = (id: string, forme: 'fiches' | 'tableau') => {
            const b = buildingById(id)
            const { occupied: occ, total } = occupancyOf(id)
            const auTableau = forme === 'tableau'
            const vide = total === 0
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
                    {/* Plus de chevron : l'immeuble ne se replie plus. Nelson l'a demandé le
                        2026-09-07 — sur bureau chaque immeuble est une carte, et replier
                        cachait la seule chose qu'on vient lire. */}
                    {/* LA TUILE D'IMMEUBLE EST PARTIE, et ce n'est pas une
                        économie de pixels.

                        Elle ne distinguait RIEN : tous les groupes de cette liste
                        sont des immeubles, et une icône qui ne varie jamais
                        n'apprend rien à personne. `User List Accordion`
                        (cnippet.dev) met un avatar en tête de ligne parce que ses
                        membres diffèrent ; ici l'image était constante.

                        Elle coûtait deux glyphes AVANT le nom — la tuile puis le
                        chevron — dont un seul commande quelque chose. Le chevron
                        reste seul, et c'est lui qu'on cherche quand on veut
                        replier. */}
                    {/* La tuile d'immeuble : le même signe que l'entrée « Parc » de la
                        navigation, pour que l'œil trouve l'immeuble avant de le lire. */}
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted"
                    >
                      <Icon name="building" size={16} />
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
                      <h3 id={`immeuble-${id}`} className="font-medium text-ink hyphens-auto break-words">
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
                    {/* CE QUE L'IMMEUBLE RAPPORTE, avant ce qu'il remplit.

                        L'en-tête portait l'occupation et la barre — jamais
                        l'argent — sur l'écran d'un propriétaire. La somme est
                        celle des loyers des lots OCCUPÉS : c'est ce qui est
                        appelé ce mois-ci, pas ce que l'immeuble vaudrait plein.
                        Le manque à gagner des lots vides se lit sur leurs
                        lignes, où la colonne Loyer dit « attendu ».

                        Masquée sous `sm` : la boîte y fait moins de 320 px et le
                        montant y prendrait la place du rapport, qui est la
                        mesure de cet écran. */}
                    {/*
                      L'IMMEUBLE VIDE PORTE SON GESTE, AU LIEU DE « 0 FCFA / MOIS · 0/0 ».

                      Relevé en production : quatre résidences sans logement,
                      chacune sur une rangée pleine, disant trois fois la même
                      absence — la mention « aucun logement », un loyer de zéro,
                      un rapport de zéro sur zéro — et n'offrant AUCUN moyen d'y
                      remédier. Le seul chemin était le bouton de page, qui
                      rouvrait la liste sur le PREMIER immeuble du parc.

                      C'est le lot des logements vacants, à l'étage au-dessus :
                      une chose vide porte le geste qui la remplit. Le montant, le
                      rapport et la barre partent ; ils étaient exacts et muets.

                      LE NOM ACCESSIBLE PORTE L'IMMEUBLE. Quatre immeubles vides,
                      c'est quatre boutons dont le texte visible est le même : un
                      lecteur d'écran qui les liste doit pouvoir les distinguer.
                      Même idiome que les entrées du menu, juste à côté.
                    */}
                    {vide ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="plus"
                        onClick={() => setLogementPour(id)}
                        aria-label={t('app.portfolio.addUnitTo', { name: b?.name ?? '' })}
                      >
                        {t('app.portfolio.addUnitTitle')}
                      </Button>
                    ) : (
                      <>
                        <span className="numeric hidden text-body text-muted sm:inline">
                          {t('app.portfolio.buildingRent', {
                            amount: money(loyerDe(id), { compact: true }),
                          })}
                        </span>
                        <span className="numeric font-medium">{`${occ}/${total}`}</span>
                      </>
                    )}
                    {/* LA BARRE CONTRE SON RAPPORT au tableau — 96 px, la
                        largeur d'une mesure, pas d'un séparateur. Elle SITUE
                        l'immeuble qu'on lit ; elle ne compare plus rien puisque
                        les en-têtes ne s'alignent pas comme s'alignait la
                        grille de cartes. `hideValue` : le rapport est écrit en
                        chiffres à trois pixels de là. */}
                    {auTableau && !vide ? (
                      <div className="w-24">
                        <ProgressBar
                          value={tauxDe(occ, total)}
                          label={t('app.portfolio.occupancy', { occupied: occ, total })}
                          hideLabel
                          hideValue
                        />
                      </div>
                    ) : null}
                    {/* LES DEUX ISSUES DE L'IMMEUBLE, SOUS LES MÊMES TROIS POINTS
                        QUE CELLES DE SES LIGNES.

                        Elles étaient deux icônes à plat quand les lignes venaient
                        de passer au menu : deux idiomes d'action dans la même
                        bande verticale, à quelques pixels l'un de l'autre. La
                        différence de forme n'encodait rien — ni l'objet visé, ni
                        la gravité — elle disait seulement que l'écran avait été
                        fini en deux fois.

                        Six commandes de moins allumées en permanence, et une
                        seule grammaire : trois points, on ouvre, on choisit.

                        LES CONDITIONS NE CHANGENT PAS. Corriger reste toujours
                        offert — renommer n'emporte ni bail ni somme, et c'est
                        précisément sur un immeuble PLEIN que ça sert. Supprimer
                        reste FERMÉ tant qu'il porte des logements, et son entrée
                        dit le motif avec le compte : un geste absent du menu ne
                        s'explique pas. */}
                    <MenuDeDebordement
                      libelle={t('app.portfolio.buildingActions', { name: b?.name ?? '' })}
                    >
                      <MenuElement
                        icone="sliders"
                        onClick={() => b && setImmeubleACorriger(b)}
                        nomAccessible={t('app.portfolio.editBuilding', { name: b?.name ?? '' })}
                      >
                        {t('app.tenants.edit')}
                      </MenuElement>
                      <MenuElement
                        icone="close"
                        onClick={total === 0 && b ? () => setASupprimer(b) : undefined}
                        nomAccessible={
                          total === 0
                            ? t('app.portfolio.deleteBuilding', { name: b?.name ?? '' })
                            : t('app.portfolio.deleteBuildingBlocked', {
                                name: b?.name ?? '',
                                count: total,
                              })
                        }
                      >
                        {t('app.portfolio.remove')}
                      </MenuElement>
                    </MenuDeDebordement>
                  </div>
                </div>
                {/* EN FICHES SEULEMENT : la boîte fait moins de 320 px, la barre
                    y prend toute la largeur sous le nom, où elle situe
                    l'immeuble qu'on est en train de lire. */}
                {auTableau || vide ? null : (
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
  }

  /*
    LE PARC SUR BUREAU : UNE CARTE PAR IMMEUBLE, UNE FICHE PAR LOGEMENT.

    Le tableau groupé portait le vide — une colonne absorbait jusqu'à 396 px de
    blanc — et une ligne par logement où l'état se cherchait parmi des cellules
    de même poids. La forme vient d'une référence que Nelson a montrée le
    2026-09-07 : l'immeuble en carte, occupation et loyer mensuel en tête ; ses
    logements en grille de fiches — numéro et état en haut, locataire, type ·
    surface, loyer —, et sur un logement vacant, le geste qui le remplit.
    Sous `lg`, rien ne change : `DataTable` rend déjà des fiches.

    Deux par rangée à `lg`, trois à `xl`, quatre à `2xl` : une fiche garde au
    moins 280 px, assez pour un nom de locataire entier sans le couper.
  */
  const parcEnCartes = (
    <div className="flex flex-col gap-4">
      {ordreDesImmeubles.map((id) => {
        const lignes = rows.filter((u) => u.buildingId === id)
        // Une recherche qui ne touche pas cet immeuble ne le montre pas.
        if (query && lignes.length === 0) return null
        const b = buildingById(id)
        return (
          /* PAS d'`overflow-hidden` sur la carte : le menu de l'immeuble est un
             panneau `absolute` DANS la carte, et sur le dernier immeuble il
             s'ouvre vers le haut, hors d'elle. Rogné, il restait invisible et le
             clic tombait sur la carte du dessus — `modales.mjs` l'a mesuré :
             « le bouton a été cliqué et aucune boîte n'est apparue ». */
          <Card key={id} as="section" flush aria-labelledby={`immeuble-${id}`}>
            {enTeteDImmeuble(id, 'tableau')}
            {lignes.length > 0 && (
              <ul
                id={idDuGroupe(id)}
                aria-label={b?.name}
                className={GRILLE_DES_FICHES}
                data-mesure="sections-alignees"
              >
                {lignes.map((unit) => (
                  <li
                    key={unit.id}
                    data-fiche-logement=""
                    className={cn(
                      SECTIONS_DE_FICHE_LOGEMENT,
                      'rounded-lg border border-divider bg-surface p-4',
                    )}
                  >
                    <div data-section="entete" className="flex items-start justify-between gap-2">
                      {/* Le lien EST sa boîte de 48 × 44 — pas un `after:inset-0`
                          étendu sur une zone : la sonde des cibles part du centre
                          du lien et s'écarte des deux côtés, et une zone qui ne
                          s'étend qu'à droite comptait pour 34 px. Mesuré. */}
                      <Link
                        to={lien(base, `parc/${unit.id}`)}
                        state={{ from: `${location.pathname}${location.search}` }}
                        aria-label={t('app.unitFile.open', { unit: unit.label })}
                        className="numeric title-m inline-flex min-h-11 min-w-12 items-center text-ink underline-offset-4 hover:underline"
                      >
                        {unit.label}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {unit.status === 'vacant' ? (
                          <span className="sr-only">{t('app.portfolio.nothingDue')}</span>
                        ) : (
                          <PaymentStatusPill status={unit.status} size="sm" />
                        )}
                        <MenuDeDebordement
                          libelle={t('app.portfolio.unitActions', { unit: unit.label })}
                        >
                          <MenuElement
                            icone="sliders"
                            onClick={() => setLogementACorriger(unit)}
                            nomAccessible={t('app.portfolio.editUnit', { unit: unit.label })}
                          >
                            {t('app.tenants.edit')}
                          </MenuElement>
                          <MenuElement
                            icone="close"
                            onClick={
                              unit.deletable === true ? () => setLogementASupprimer(unit) : undefined
                            }
                            nomAccessible={
                              unit.deletable === true
                                ? t('app.portfolio.deleteUnit', { unit: unit.label })
                                : t('app.portfolio.deleteUnitBlocked', { unit: unit.label })
                            }
                          >
                            {t('app.portfolio.remove')}
                          </MenuElement>
                        </MenuDeDebordement>
                      </div>
                    </div>
                    <p
                      data-donnee
                      data-section="occupant"
                      className={cn(
                        'truncate pt-2 text-body',
                        unit.tenant ? 'font-medium text-ink' : 'text-muted italic',
                      )}
                      title={unit.tenant ?? undefined}
                    >
                      {unit.tenant ?? t('app.portfolio.noTenant')}
                    </p>
                    {/* LE TYPE, LA SURFACE, ET DEPUIS QUAND — d'un trait, sur la
                        ligne que TOUTES les fiches portent, vides comprises.

                        La date avait sa rangée, sous l'occupant : une fiche vide
                        n'en a pas, et ses voisines la réservaient. Un bail de six
                        ans et un bail de deux mois ne se lisent pas pareil, et
                        cette date vit déjà dans le dossier du logement — elle est
                        ici un repère, pas une colonne.

                        PAS SUR LA LIGNE DE L'OCCUPANT, où elle aurait sa place de
                        sens : un nom saisi n'a pas de longueur bornée, cette
                        ligne-là se coupe (`data-donnee`), et la date serait partie
                        avec la fin du nom.

                        Une section conditionnelle qui reste — les jauges, les
                        faits, le geste — garde sa rangée, VIDE quand elle n'a rien
                        à dire : c'est ce qui aligne la suivante sur celle des
                        voisines. L'écart d'avant vit dans le contenu. */}
                    <p data-section="type" className="pt-2 text-body text-muted">
                      {t(`app.unitTypes.${unit.type}` as 'app.unitTypes.T1')} · {unit.surface} m²
                      {unit.tenant && unit.leaseStart
                        ? ` · ${t('app.portfolio.sinceLease', { date: d.monthYearInline(unit.leaseStart) })}`
                        : ''}
                    </p>
                    {/* Le loyer, et ce qu'il en est ce mois : un partiel montre le
                        reçu sur l'attendu — c'est le chiffre qu'on vient chercher. */}
                    <p data-section="loyer" className="numeric pt-2 text-body">
                      {unit.status === 'partial' ? (
                        <>
                          {money(unit.paid, { compact: true })}
                          <span className="text-muted"> / {money(unit.rent, { compact: true })}</span>
                        </>
                      ) : (
                        money(unit.rent, { compact: true })
                      )}
                      {unit.status === 'vacant' && (
                        <span className="ml-1 text-muted">{t('app.portfolio.rentExpected')}</span>
                      )}
                      {unit.overdueDays ? (
                        <span className="numeric ml-2 text-label text-danger">
                          {t('app.portfolio.overdueFor', { days: unit.overdueDays })}
                        </span>
                      ) : null}
                    </p>
                    {/* LES TROIS POSTES DU MOIS AFFICHÉ — loyer · eau · électricité —
                        par le composant de la grille des paiements, donc de la même
                        forme que sa légende. Un partiel de loyer et une eau impayée
                        n'appellent pas le même geste, et la pastille d'état ne sait
                        pas le dire. Rien sans échéance : la pastille porte déjà
                        « non appelé » ou « vacant ».

                        ET LA PART REÇUE D'UN PARTIEL, EN BARRE, SUR LA MÊME LIGNE.
                        « 40 000 / 75 000 » se calcule, une barre à moitié se voit —
                        seulement sur un partiel, un « À jour » à 100 % n'apprendrait
                        rien. Elle avait sa rangée, sous le loyer ; depuis que les
                        fiches partagent leurs rangées, toutes les voisines d'un
                        partiel la RÉSERVAIENT, 14 px de blanc sous leur loyer. Elle
                        dit la part du loyer, le premier des trois postes : elle se
                        pose à droite de leurs pastilles, qui laissent la place, et
                        ne grandit pas la ligne — 6 px de barre pour 12 de pastille. */}
                    {/* LA QUEUE DE LA FICHE — ce qu'elle a de plus à dire, et qui
                        varie : les jauges du mois, les faits, le geste d'un
                        logement vide. UNE SEULE rangée, et elle n'est pas
                        déclarée à `MESURER_SECTIONS_ALIGNEES`.

                        Les trois avaient chacune la leur, partagée avec les
                        voisines : une fiche occupée réservait 56 px pour le
                        bouton d'un logement vide, 33 pour ses pastilles de faits,
                        18 pour des jauges qu'il n'a pas — jusqu'à 196 px sur une
                        rangée, mesuré le 2026-09-12. Ce vide-là tombait au MILIEU
                        de la fiche, où il se lit comme une donnée manquante.

                        Ensemble et sans nom, ce qui reste de place tombe EN BAS,
                        sous le contenu, où il se lit comme une fiche qui a moins à
                        dire. Les fiches d'une rangée gardent la même hauteur de
                        toute façon : ce lot ne choisit pas s'il y a du blanc, il
                        choisit où. */}
                    <div>
                      {(() => {
                        const echeance = echeanceDuMois(unit)
                        const partiel = unit.status === 'partial' && unit.rent > 0
                        if (!echeance && !partiel) return null
                        return (
                          <div className="flex items-center gap-3 pt-2">
                            {echeance && (
                              <JaugesDePeriode receipt={echeance} periode={d.monthYear(periodeAffichee)} />
                            )}
                            {partiel && (
                              <div className="min-w-0 flex-1">
                                <ProgressBar
                                  value={Math.round((unit.paid / unit.rent) * 100)}
                                  label={t('app.portfolio.paidOfRent', {
                                    paid: money(unit.paid, { compact: true }),
                                    rent: money(unit.rent, { compact: true }),
                                  })}
                                  hideLabel
                                  hideValue
                                />
                              </div>
                            )}
                          </div>
                        )
                      })()}

                    {(() => {
                      const chantiers = works.filter(
                        (w) => w.unitId === unit.id && w.status !== 'done',
                      ).length
                      const caution = deposits.find(
                        (c) => c.unitId === unit.id && c.status === 'held',
                      )
                      if (chantiers === 0 && !caution) return null
                      return (
                        /* Deux faits au plus, et seulement quand ils existent : un
                           chantier ouvert change ce qu'on fera du logement, une
                           caution tenue dit ce qu'on doit au locataire. */
                        <div className="flex flex-wrap gap-1.5 pt-3">
                          {chantiers > 0 && (
                            <Badge icon="wrench">
                              {t('app.portfolio.openWorks', { count: chantiers })}
                            </Badge>
                          )}
                          {caution && (
                            <Badge icon="shield">
                              {t('app.portfolio.depositHeld', {
                                amount: money(caution.held, { compact: true }),
                              })}
                            </Badge>
                          )}
                        </div>
                      )
                    })()}
                      {unit.status === 'vacant' && (
                        <div className="pt-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="users"
                            onClick={() => setAAttribuer(unit)}
                          >
                            {t('app.portfolio.assignTenant')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )

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
      {logementASupprimer && (
        <Modal
          open
          onClose={() => setLogementASupprimer(null)}
          title={t('app.portfolio.deleteUnitTitle', { unit: logementASupprimer.label })}
          /* LE CORPS DIT CE QUI EST VRAI DE CE LOGEMENT-CI, et pas seulement que
             l'acte est définitif : « n'a jamais porté de bail, de relevé ni de
             travaux » est la CONDITION qui a ouvert le geste. Elle rassure celui
             qui hésite, et elle apprend la règle à celui qui la découvre ici. */
          description={t('app.portfolio.deleteUnitBody')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setLogementASupprimer(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  removeUnit(logementASupprimer.id)
                  setLogementASupprimer(null)
                  notify(t('app.portfolio.deleteUnitDone'), { tone: 'ok' })
                }}
              >
                {t('common.confirm')}
              </Button>
            </>
          }
        >
          {/* L'IMMEUBLE, parce que « A1 » ne désigne rien seul — c'est la même
              raison qui met son nom dans la trace du registre. */}
          <p className="text-body text-muted">
            {buildingById(logementASupprimer.buildingId)?.name}
          </p>
        </Modal>
      )}
      {(logementOuvert || logementPour) && (
        <AddUnitModal
          open
          immeuble={logementPour ?? undefined}
          onClose={() => {
            setLogementOuvert(false)
            setLogementPour(null)
          }}
        />
      )}

      {immeubleACorriger && (
        <EditBuildingModal
          immeuble={immeubleACorriger}
          onClose={() => setImmeubleACorriger(null)}
        />
      )}
      {logementACorriger && (
        <EditUnitModal unit={logementACorriger} onClose={() => setLogementACorriger(null)} />
      )}
      {aAttribuer && <NewTenantModal vacant={[aAttribuer]} onClose={() => setAAttribuer(null)} />}

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
      {unitesAffichees.length === 0 || !enTableau ? null : (
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
          value={`${tauxDe(occupied, unitesAffichees.length)}`}
          unit="%"
          /* LE COMPTAGE BRUT SOUS LE POURCENTAGE : sur douze logements, « 83 % »
             seul cacherait les deux à relouer. */
          note={t('app.portfolio.occupancy', { occupied, total: unitesAffichees.length })}
          bas={
            <div className="mt-3">
              <ProgressBar
                value={tauxDe(occupied, unitesAffichees.length)}
                label={t('app.portfolio.occupancy', { occupied, total: unitesAffichees.length })}
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

        {/* LE MOIS AFFICHÉ, ENFIN CHOISISSABLE.

            ═══ FERMÉ EN DÉMONSTRATION, ET IL LE DIT ═══

            Le jeu de démonstration ne porte pas d'historique d'échéances : sa
            vue est celle d'un seul mois. Deux issues étaient possibles, et la
            troisième a été prise :

              · le laisser AGIR sans que rien ne change — il mentirait, et sur
                le nombre le plus sensible de l'écran ;
              · le CACHER hors d'un vrai parc — mais `mesure-ui`, `modales` et
                `espace-connecte` ne visitent que `/demo` : sa géométrie, son
                contraste et ses cibles ne seraient mesurés par personne. Le
                dépôt s'est déjà payé cet écran-là.
              · le montrer FERMÉ, avec son motif. C'est l'idiome des deux
                suppressions du Parc, et il vaut ici pour la même raison : un
                geste absent ne s'explique pas.

            `aria-disabled` et non `disabled` : la raison reste atteignable au
            clavier. */}
        <div
          /* `gap-2` : le standard maison entre deux commandes — `gap-1` vaut
             4 px et `ecarts` le refuse dans une rangée de cibles. */
          className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-1 sm:w-auto"
          role="group"
          aria-label={t('app.portfolio.monthShown')}
        >
          <button
            type="button"
            aria-disabled={!parkId || undefined}
            aria-label={
              parkId
                ? t('app.portfolio.previousMonth')
                : t('app.portfolio.monthLockedInDemo')
            }
            onClick={parkId ? () => setMois(moisDecale(moisChoisi, -1)) : undefined}
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-md',
              parkId
                ? 'cursor-pointer text-muted hover:bg-surface-2 hover:text-ink'
                : 'cursor-not-allowed text-muted opacity-45',
            )}
          >
            <Icon name="chevronLeft" size={15} />
          </button>
          {/* `aria-live` : changer de mois ne déplace pas le focus — il reste
              sur la flèche — donc rien n'annoncerait le mois atteint. */}
          {/* UN SÉLECTEUR, PAS SEULEMENT DEUX FLÈCHES. Remonter de dix mois à
              coups de flèche, c'est dix rechargements du parc ; le sélecteur
              saute où l'on veut. `max` ferme les mois à venir — le parc n'a
              rien à dire d'un mois qui n'est pas arrivé.

              EN DÉMONSTRATION AUSSI. Elle ne porte qu'un mois, et la première
              forme lui laissait un libellé passif : Nelson l'a pris pour un
              sélecteur en panne, et il avait raison de le prendre pour un
              sélecteur. Il s'ouvre donc partout ; en démo, `min` et `max` sont
              le mois courant, et tout autre mois se voit FERMÉ — la même
              honnêteté que les deux flèches, dans le même panneau. */}
          {/* SOUS `sm`, LE GROUPE PREND TOUTE LA RANGÉE et le sélecteur s'étire
              entre ses deux flèches : à 320 px il débordait de 10 px avec une
              largeur fixe, puis tenait à un pixel près avec sa largeur naturelle
              (164 px en corps de 16) — trop peu pour la police large que la porte
              impose. Étiré, il ne peut plus déborder, quelle que soit la police. */}
          <div className="min-w-0 flex-1 sm:min-w-36 sm:flex-none">
            <MonthPicker
              aria-label={t('app.portfolio.monthShown')}
              aria-describedby={parkId ? undefined : idDuVerrouDemo}
              name="mois"
              value={moisChoisi}
              onChange={setMois}
              max={moisCourant}
              min={parkId ? undefined : moisCourant}
            />
            {!parkId && (
              <span id={idDuVerrouDemo} className="sr-only">
                {t('app.portfolio.monthLockedInDemo')}
              </span>
            )}
          </div>
          <button
            type="button"
            /* PAS D'AVANT-DEMAIN. Un mois futur n'a rien d'appelé : la vue y
               serait « Non appelé » sur toute la colonne, ce qui se lit comme
               un défaut du parc plutôt que comme un calendrier. */
            aria-disabled={!parkId || moisChoisi >= moisCourant || undefined}
            aria-label={
              !parkId
                ? t('app.portfolio.monthLockedInDemo')
                : moisChoisi >= moisCourant
                  ? t('app.portfolio.noFutureMonth')
                  : t('app.portfolio.nextMonth')
            }
            onClick={
              parkId && moisChoisi < moisCourant
                ? () => setMois(moisDecale(moisChoisi, 1))
                : undefined
            }
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-md',
              parkId && moisChoisi < moisCourant
                ? 'cursor-pointer text-muted hover:bg-surface-2 hover:text-ink'
                : 'cursor-not-allowed text-muted opacity-45',
            )}
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </div>

      </div>

      {/* LA LÉGENDE DES JAUGES, une fois, et seulement quand une fiche en porte :
          sans échéance ce mois-ci, il n'y a pas de pastille à expliquer. Même
          composant que la légende de Paiements — voir `JaugesDePeriode`. */}
      {rows.some(echeanceDuMois) && (
        <LegendeDesPostes intitule={t('app.portfolio.legendPosts')} className="mb-3" />
      )}

      {/* `aria-busy` PENDANT LA RELECTURE, et rien d'autre.

          Le temps qu'un autre mois revienne, la table montre encore celui qu'on
          vient de quitter — ce qui est faux pendant une fraction de seconde. La
          remplacer par un squelette ferait sauter la page à chaque flèche, sur
          un écran qu'on parcourt mois par mois ; l'attribut dit l'attente à qui
          l'écoute sans rien déplacer pour qui la regarde. C'est le compromis, et
          il est assumé : ce que l'œil voit reste d'un instant en retard. */}
      <div aria-busy={lectureDuMois || undefined}>
      {enTableau && unitesAffichees.length > 0 && rows.length > 0 ? (
        parcEnCartes
      ) : (
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
          enTete: (id, _lignes, forme) => enTeteDImmeuble(id, forme),
        }}
        empty={
          /* Deux absences, deux messages. Un parc sans aucun logement n'a pas
             « échoué à trouver » : il n'a rien à trouver. L'écran annonçait
             pourtant « Aucune unité ne correspond à «  » » — la requête vide
             entre ses guillemets — et proposait de réinitialiser des filtres
             qu'on n'avait pas posés. C'est le premier écran d'un compte neuf. */
          unitesAffichees.length === 0 ? (
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
            /* LE MÊME NOMBRE, REQUALIFIÉ. Sur un lot vacant la cellule affichait
               « 118 000 FCFA » exactement comme sur un lot loué : rien ne disait
               que personne ne le verse. Un écran de propriétaire ne doit pas
               faire lire un manque à gagner comme un revenu.

               Le mot suit le montant sur la MÊME ligne, en gris muet : empilé,
               il rendrait deux rangées sur douze plus hautes que les autres, et
               une table se lit par l'égalité de ses lignes. */
            render: (unit) =>
              unit.status === 'vacant' ? (
                <>
                  {money(unit.rent, { compact: true })}{' '}
                  <span className="text-body font-normal text-muted">
                    {t('app.portfolio.rentExpected')}
                  </span>
                </>
              ) : (
                money(unit.rent, { compact: true })
              ),
          },
          {
            key: 'status',
            role: 'etat',
            /* BORNÉE, parce que c'est elle qui absorbait le mou. Seule `unit`
               avait une largeur ; le tableau est en disposition automatique, et
               la cellule « pastille + en retard depuis N j » a le plus grand
               contenu de la ligne : à 1440–1920 px, c'est elle qui s'étirait —
               de 109 à 396 px de vide relevés — et la pastille restait seule à
               gauche d'un champ blanc. Le mou se reporte sur `tenant`, seule
               colonne sans borne, où un nom a l'usage de la place. Locale, pas
               globale : contraindre `main` déplaçait le défaut sur les autres
               écrans (tenté et retiré le 2026-09-06). */
            width: '12rem',
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
                <span className="flex flex-wrap items-center gap-1.5">
                  <PaymentStatusPill status={unit.status} size="sm" />
                  {/* LA DURÉE À CÔTÉ DE L'ÉTAT, et seulement quand elle existe.
                      « En retard » est vrai à trois jours comme à vingt-quatre,
                      et les deux n'appellent pas le même geste — relancer ou
                      mettre en demeure. `overdueDays` était déjà sur la ligne,
                      la pastille le jetait.

                      Hors de la pastille : `StatusPill` porte un MOT, pas une
                      phrase — c'est écrit dans sa doctrine, et un statut qui se
                      coupe en deux lignes n'est plus un statut. `flex-wrap` pour
                      que les deux se rangent l'un sous l'autre quand la colonne
                      se resserre. */}
                  {unit.overdueDays ? (
                    <span className="numeric text-body text-muted">
                      {t('app.portfolio.overdueFor', { days: unit.overdueDays })}
                    </span>
                  ) : null}
                </span>
              ),
          },
          {
            /* SOUS `lg`, LES MÊMES JAUGES DANS LES FICHES. `serie` est le rôle
               que `DataTable` rend en grille dans une fiche — celui des six
               périodes de Paiements ; ici une seule colonne. Sans échéance,
               un tiret nommé : « vacant » ou « non appelé », jamais un impayé. */
            key: 'postes',
            role: 'serie',
            header: t('app.portfolio.posts'),
            hideOnMobile: true,
            render: (unit) => {
              const echeance = echeanceDuMois(unit)
              if (echeance) {
                return <JaugesDePeriode receipt={echeance} periode={d.monthYear(periodeAffichee)} />
              }
              return (
                <span
                  role="img"
                  className="text-muted"
                  aria-label={`${d.monthYear(periodeAffichee)} · ${
                    unit.status === 'vacant'
                      ? t('app.portfolio.nothingDue')
                      : t(`status.${unit.status}` as 'status.paid')
                  }`}
                >
                  —
                </span>
              )
            },
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
              /* LES DEUX GESTES SE REPLIENT DERRIÈRE TROIS POINTS.

                 Ils étaient posés à plat sur chaque ligne : « Corriger » et une
                 croix, douze fois, plus deux par en-tête d'immeuble — vingt-six
                 commandes allumées en permanence, qui rivalisaient d'attention
                 avec la donnée qu'on vient lire. C'est le motif que la toute
                 première planche de références citait déjà, chez shadcnstore :
                 un menu `Actions` par ligne, plutôt qu'une colonne de boutons.

                 LE NOM ACCESSIBLE DE CHAQUE ENTRÉE PORTE SA CIBLE — « Corriger
                 le logement A1 » — parce que le geste se répète : douze entrées
                 « Corriger » ne diraient pas laquelle on active, et c'est ce
                 qu'une synthèse vocale annonce ligne après ligne. C'est aussi ce
                 par quoi `modales` et `clavierDesModales` les retrouvent, dans
                 le menu, qu'ils savent tous deux ouvrir.

                 LE RETRAIT FERMÉ RESTE VISIBLE, et dit toujours pourquoi : un
                 geste absent du menu ne s'explique pas, et c'est la règle que ce
                 lot a posée sur les deux autres suppressions du Parc. */
              <div className="flex items-center justify-end">
                <MenuDeDebordement libelle={t('app.portfolio.unitActions', { unit: unit.label })}>
                  <MenuElement
                    icone="sliders"
                    onClick={() => setLogementACorriger(unit)}
                    nomAccessible={t('app.portfolio.editUnit', { unit: unit.label })}
                  >
                    {t('app.tenants.edit')}
                  </MenuElement>
                  <MenuElement
                    icone="close"
                    onClick={
                      unit.deletable === true ? () => setLogementASupprimer(unit) : undefined
                    }
                    nomAccessible={
                      unit.deletable === true
                        ? t('app.portfolio.deleteUnit', { unit: unit.label })
                        : t('app.portfolio.deleteUnitBlocked', { unit: unit.label })
                    }
                  >
                    {t('app.portfolio.remove')}
                  </MenuElement>
                </MenuDeDebordement>
              </div>
            ),
          },
        ]}
      />
      )}
      </div>
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

        {/* Deux formes, comme l'écran chargé : des fiches sous `lg` (celles de
            `SkeletonTable`), une carte d'immeuble et sa grille de fiches au-delà.
            Un squelette de tableau annoncerait une forme qui ne vient plus. */}
        <div className="lg:hidden">
          <SkeletonTable fiches />
        </div>
        <div aria-hidden="true" className="hidden flex-col gap-4 lg:flex">
          {[0, 1].map((immeuble) => (
            <Card key={immeuble} flush>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <Skeleton line="body" className="w-56" />
                <Skeleton line="body" className="w-40" />
              </div>
              <div className={GRILLE_DES_FICHES}>
                {[0, 1, 2].map((fiche) => (
                  <div key={fiche} className="mb-3 rounded-lg border border-divider p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton line="body" className="w-10" />
                      <Skeleton line="body" className="w-16" />
                    </div>
                    <Skeleton line="body" className="mt-3 w-3/5" />
                    <Skeleton line="body" className="mt-1.5 w-1/2" />
                    <Skeleton line="body" className="mt-1.5 w-2/5" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </SkeletonRegion>
    </>
  )
}
