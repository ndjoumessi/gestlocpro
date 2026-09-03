import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
import { SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS } from '@/currency/currencies'
import { PAYMENT_METHOD_LABELS, type PaymentMethodKey } from '@/data/portfolio'
import { useSession } from '@/api/SessionProvider'
import { decisionsDemo } from '@/data/portfolio'
import { api } from '@/api/client'

/**
 * LE REGISTRE DES DÉCISIONS — ce que le parc a écrit, et qui l'a écrit.
 *
 * ═══ CE QUI DORMAIT DEPUIS DES MOIS ═══
 *
 * `AuditEvent` est écrit à vingt-deux endroits du serveur, et n'était LU nulle
 * part — sauf par les tests. Le produit tenait une piste d'audit qu'il n'ouvrait
 * jamais : un propriétaire ne pouvait pas savoir qui avait arbitré une caution,
 * validé un devis ou retiré un versement de son registre, alors que la base le
 * savait. C'est le sujet le moins cher du produit — la donnée existait, il
 * manquait une route et cet écran.
 *
 * ═══ IL EST DISTINCT DU REGISTRE DES ACCÈS, ET C'EST VOULU ═══
 *
 * `Access` répond à « qui a le droit », celui-ci à « qui a fait ». Les fondre
 * ferait un écran qui répond à deux questions et n'en pose aucune — et leurs
 * durées de vie diffèrent : la liste des membres tient en cinq lignes et se lit
 * d'un coup, un registre s'allonge indéfiniment et se parcourt.
 *
 * ═══ LE PROPRIÉTAIRE SEUL ═══
 *
 * Le registre existe pour qu'il contrôle ce qu'il a délégué. Le serveur le tient
 * par un 403 ; l'écran ne s'offre ni par le menu ni par l'adresse, parce qu'un
 * écran qui promet ce que la porte refuse est pire qu'un écran absent.
 */


/**
 * CE QUE CHAQUE DÉCISION A CHANGÉ, et comment le lire.
 *
 * ═══ POURQUOI UNE TABLE DE CHAMPS ET NON VINGT-DEUX PHRASES ═══
 *
 * `payload` est un `Json` dont la forme varie selon l'action — c'est écrit dans
 * le schéma, et c'est juste : figer des colonnes obligerait à migrer la base à
 * chaque nouvelle décision traçable. Le prix est ici : vingt-deux formes à
 * rendre.
 *
 * Écrire vingt-deux phrases donnerait vingt-deux endroits à corriger le jour où
 * un `payload` gagne un champ, et vingt-deux occasions d'oublier de mettre un
 * montant en forme. La table nomme, pour chaque action, les CHAMPS à montrer et
 * leur NATURE ; six fonctions savent rendre une nature. Ajouter une décision
 * traçable est une ligne.
 *
 * ═══ CE QUI EST OMIS EST OMIS EXPRÈS ═══
 *
 * Un champ absent du payload ne rend rien — pas « undefined », pas une case
 * vide. Un champ d'une nature qu'on ne sait pas lire non plus. Le rendu se
 * DÉGRADE vers le silence, jamais vers l'accolade : le pire résultat possible
 * est une ligne muette, et c'est encore une ligne juste.
 *
 * Les natures techniques ne figurent pas dans cette table — le type MIME d'une
 * photo, l'identifiant d'une réserve, le statut interne d'un chantier. Elles
 * sont exactes et n'apprennent rien à qui relit son parc.
 */
type Nature =
  | 'argent'
  | 'date'
  | 'mois'
  | 'texte'
  | 'moyen'
  | 'devise'
  | 'piece'
  | 'service'
  /* Le RÔLE d'une adhésion. « Accès repris » ne disait pas de qui : d'un
     gestionnaire, d'un locataire ? Le journal l'écrivait depuis toujours dans
     sa charge utile, et l'écran n'en montrait rien. */
  | 'role'
  /* L'état d'un chantier rouvert — la seule donnée que `work.reopen` porte. */
  | 'etatChantier'
  /* Une LISTE DE NOMS. « 2 immeubles » ne disait pas LESQUELS : le registre
     portait les identifiants, que l'écran ne peut pas montrer — un UUID est du
     bruit qui a l'air d'une information. Le serveur écrit désormais les noms à
     côté des identifiants, et cette nature les rend. */
  | 'liste'

/**
 * UN NOMBRE NU NE DIT RIEN. « Relance envoyée · 4 » : quatre quoi ?
 *
 * Une première rédaction avait une nature `nombre` sans unité, et l'écran
 * rendait des chiffres orphelins sous des libellés qui ne les expliquaient pas.
 * Un décompte porte donc SA clé — accordée en nombre par le dictionnaire, comme
 * partout ailleurs dans ce produit.
 */
type Decompte =
  | 'reminders'
  | 'findings'
  | 'charges'
  /* Le périmètre confié se compte : « 3 immeubles · 2 logements ». Les
     identifiants eux-mêmes ne se montrent pas — un UUID à l'écran est du bruit
     qui a l'air d'une information. */
  | 'buildings'
  | 'homes'
  | 'exclusions'

type Champ = { champ: string; nature: Nature } | { champ: string; decompte: Decompte }

const DETAIL: Record<string, Champ[]> = {
  /* LES DÉCISIONS D'ACCÈS DISAIENT « quelque chose a changé » SANS DIRE QUOI.
     Onze actions du serveur n'avaient aucune recette ; celles-ci portaient
     pourtant une donnée lisible sans aller la chercher ailleurs. Restent dehors
     `access.link` et `access.unlink`, dont la charge utile n'est qu'un
     identifiant de compte : le montrer brut serait pire que de se taire. */
  /* LE COMPTE PUIS LES NOMS, et les deux servent. « 12 immeubles » dit
     l'ampleur, « Résidence A, Villa B, Le Clos +9 » dit lesquels. Les lignes
     écrites AVANT le 2026-09-03 ne portent pas de noms : elles gardent leur
     décompte, et n'affichent rien de plus — une recette qui ne trouve pas son
     champ se tait. */
  'access.scope': [
    { champ: 'buildingIds', decompte: 'buildings' },
    { champ: 'buildingNames', nature: 'liste' },
    { champ: 'unitIds', decompte: 'homes' },
    { champ: 'unitLabels', nature: 'liste' },
    { champ: 'excludedUnitIds', decompte: 'exclusions' },
    { champ: 'role', nature: 'role' },
  ],
  'access.grant': [{ champ: 'role', nature: 'role' }],
  'access.refuse': [{ champ: 'role', nature: 'role' }],
  'access.join': [{ champ: 'role', nature: 'role' }],
  'access.revoke': [{ champ: 'role', nature: 'role' }],
  'work.reopen': [{ champ: 'status', nature: 'etatChantier' }],
  'payment.record': [
    { champ: 'amountMinor', nature: 'argent' },
    { champ: 'method', nature: 'moyen' },
  ],
  'payment.delete': [
    { champ: 'amountMinor', nature: 'argent' },
    { champ: 'method', nature: 'moyen' },
    { champ: 'paidOn', nature: 'date' },
  ],
  'receipt.issued': [
    { champ: 'kind', nature: 'piece' },
    { champ: 'periodStart', nature: 'mois' },
    { champ: 'paidMinor', nature: 'argent' },
  ],
  /* LE MOTIF APRÈS LE MONTANT, et il compte autant : le montant est ce qu'on
     vérifie, le motif ce qu'on conteste. */
  'deposit.settle': [
    { champ: 'withheldMinor', nature: 'argent' },
    { champ: 'reason', nature: 'texte' },
  ],
  'deposit.unsettle': [{ champ: 'withheldMinor', nature: 'argent' }],
  'work.quote': [{ champ: 'quotedAmountMinor', nature: 'argent' }],
  'work.approve': [{ champ: 'approvedAmountMinor', nature: 'argent' }],
  'work.complete': [{ champ: 'completedOn', nature: 'date' }],
  'inspection.record': [
    { champ: 'findings', decompte: 'findings' },
    { champ: 'billableMinor', nature: 'argent' },
  ],
  /* L'ÉNERGIE D'ABORD : un prix au mètre cube et un prix au kilowattheure ne se
     comparent pas, et le second n'a de sens qu'avec son unité. */
  'tariff.set': [
    { champ: 'utility', nature: 'service' },
    { champ: 'unitPriceMinor', nature: 'argent' },
    { champ: 'effectiveFrom', nature: 'date' },
  ],
  'park.update': [
    { champ: 'name', nature: 'texte' },
    { champ: 'currency', nature: 'devise' },
  ],
  'tenant.create': [
    { champ: 'fullName', nature: 'texte' },
    { champ: 'rentMinor', nature: 'argent' },
    { champ: 'startsOn', nature: 'date' },
  ],
  'tenant.delete': [{ champ: 'fullName', nature: 'texte' }],
  'rent.call': [
    { champ: 'periodStart', nature: 'mois' },
    { champ: 'count', decompte: 'charges' },
  ],
  'rent.remind': [{ champ: 'count', decompte: 'reminders' }],
  'lease.formal_notice': [
    { champ: 'dueMinor', nature: 'argent' },
    { champ: 'reason', nature: 'texte' },
  ],
}

interface DecisionApi {
  id: string
  action: string
  entity: string
  entityId: string
  payload: unknown
  at: string
  actor: string | null
}

interface RegistreApi {
  decisions: DecisionApi[]
  /** Curseur de la page suivante, `null` quand le registre est épuisé. */
  suivant: string | null
}

export function Decisions() {
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const { adhesionActive, estDemo } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [registre, setRegistre] = useState<DecisionApi[] | null>(null)
  const [suivant, setSuivant] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [enSuite, setEnSuite] = useState(false)
  /**
   * L'ÉCHEC DE LECTURE EST RETENU, au lieu de passer dans un toast qui s'efface.
   *
   * Ce qui resterait derrière est « Aucune décision enregistrée » — une phrase
   * qui AFFIRME avoir regardé. Sur un registre d'audit, la confusion est
   * coûteuse : elle laisse conclure qu'il ne s'est rien passé.
   */
  const [erreur, setErreur] = useState(false)

  const charger = useCallback(async () => {
    if (!parkId) {
      /*
        LA DÉMONSTRATION SERT SON PROPRE REGISTRE, même motif qu'`Access` : sans
        cela l'écran est une impasse dans un parcours qui montre trois immeubles,
        et il n'est mesuré par personne — `mesure-ui` et `couleur-non-seule` ne
        visitent que la démonstration.

        `estDemo` et non `!parkId` seul : un compte RÉEL sans parc doit lire
        l'état vide, qui est vrai pour lui.
      */
      if (estDemo) setRegistre(decisionsDemo(new Date()) as DecisionApi[])
      setChargement(false)
      return
    }
    setChargement(true)
    setErreur(false)
    try {
      const recu = await api.decisions<RegistreApi>(parkId)
      setRegistre(recu.decisions)
      setSuivant(recu.suivant)
    } catch {
      setErreur(true)
    } finally {
      setChargement(false)
    }
  }, [parkId, estDemo])

  useEffect(() => {
    void charger()
  }, [charger])

  /**
   * La suite S'AJOUTE, elle ne remplace pas.
   *
   * Un registre se parcourt de haut en bas : recharger la page à chaque suite
   * ferait perdre ce qu'on vient de lire, et une pagination par numéro de page
   * rejouerait des lignes — le serveur pagine donc par curseur, et l'écran
   * empile.
   */
  const suite = async () => {
    if (!parkId || !suivant) return
    setEnSuite(true)
    try {
      const recu = await api.decisions<RegistreApi>(parkId, suivant)
      setRegistre((deja) => [...(deja ?? []), ...recu.decisions])
      setSuivant(recu.suivant)
    } catch {
      setErreur(true)
    } finally {
      setEnSuite(false)
    }
  }

  /**
   * Le libellé d'une action, ou un repli qui ne ment pas.
   *
   * `document.${status}` compose son action côté serveur : le dictionnaire ne
   * peut donc pas prétendre les connaître toutes, et une action inconnue vaut
   * mieux dite « Décision enregistrée » que rendue en `snake.case` de base.
   */
  /**
   * CE QU'A CHANGÉ UNE DÉCISION, en une ligne — ou rien.
   *
   * SIX NATURES, ET AUCUNE FUITE. Chaque valeur est vérifiée avant d'être
   * rendue : un nombre là où on attend un nombre, une chaîne là où on attend du
   * texte. Une valeur d'un autre type est ÉCARTÉE plutôt que convertie, parce
   * qu'un `String(objet)` rendrait « [object Object] » sur la seule ligne d'un
   * registre censé faire autorité.
   *
   * Les MONTANTS suivent la devise choisie, comme partout ailleurs : ils sont
   * écrits en unités mineures dans la devise du parc, et `money` fait le reste.
   */
  const detail = (decision: DecisionApi): string => {
    const recette = DETAIL[decision.action]
    const payload = decision.payload
    if (!recette || typeof payload !== 'object' || payload === null) return ''
    const champs = payload as Record<string, unknown>

    const morceaux = recette.map((regle) => {
      const valeur = champs[regle.champ]
      if (valeur === undefined || valeur === null) return ''

      /* Un DÉCOMPTE porte son unité, accordée en nombre : « 4 relances »,
         « 1 constat ». Le dictionnaire fait l'accord, comme partout. */
      if ('decompte' in regle) {
        /* UN NOMBRE OU UNE LISTE. `access.scope` écrit les identifiants confiés,
           pas leur compte : sans ce `length`, la seule décision qui dise
           l'étendue d'un pouvoir donné restait muette.

           UNE LISTE VIDE NE S'ÉCRIT PAS. « 0 exclusions » figurerait sur presque
           chaque ligne de périmètre, et un décompte nul ne dit rien que
           l'absence ne dise déjà. On ne touche PAS au cas du nombre nul : c'est
           le comportement d'avant, et rien ne l'a mis en cause. */
        if (Array.isArray(valeur) && valeur.length === 0) return ''
        const nombre = Array.isArray(valeur) ? valeur.length : valeur
        return typeof nombre === 'number'
          ? t(`app.decisions.units.${regle.decompte}` as 'app.decisions.units.reminders', {
              count: nombre,
            })
          : ''
      }

      switch (regle.nature) {
        case 'argent':
          return typeof valeur === 'number' ? money(valeur, { compact: true }) : ''
        case 'service':
          return valeur === 'water' || valeur === 'power'
            ? t(`app.decisions.utilities.${valeur}` as 'app.decisions.utilities.water')
            : ''
        case 'texte':
          /* Le texte du serveur passe tel quel — un motif de retenue, un nom.
             React échappe ; ce qui est refusé ici est ce qui n'est PAS du
             texte, et qui trahirait la forme interne du payload. */
          return typeof valeur === 'string' ? valeur : ''
        case 'date':
          return typeof valeur === 'string' ? d.fullDate(partiesDeDateISO(valeur)) : ''
        case 'mois':
          return typeof valeur === 'string' ? d.monthYear(partiesDeDateISO(valeur)) : ''
        case 'liste': {
          /* BORNÉE À TROIS, puis un décompte. Un gestionnaire à qui l'on confie
             quinze immeubles produirait une ligne de registre plus longue que
             l'écran ; trois noms situent la décision, le reste se compte. Le
             décompte du champ d'identifiants, juste à côté, donne le total. */
          const noms = Array.isArray(valeur) ? valeur.filter((n) => typeof n === 'string') : []
          if (noms.length === 0) return ''
          const montres = noms.slice(0, 3).join(', ')
          return noms.length > 3 ? `${montres} +${noms.length - 3}` : montres
        }
        case 'role':
          /* La liste est ÉCRITE, et non `roles.${valeur}.name` sans garde : le
             payload vient du serveur, et une valeur inattendue rendrait la clé
             en toutes lettres — le défaut que `announcement` a déjà coûté. */
          return valeur === 'owner' || valeur === 'manager' || valeur === 'tenant'
            ? t(`roles.${valeur}.name` as 'roles.owner.name')
            : ''
        case 'etatChantier':
          return valeur === 'reported' ||
            valeur === 'quoted' ||
            valeur === 'approved' ||
            valeur === 'done'
            ? t(`app.works.${valeur}` as 'app.works.reported')
            : ''
        case 'moyen': {
          const cle = PAYMENT_METHOD_LABELS[valeur as PaymentMethodKey]
          return cle ? t(cle as 'app.payments.methodCash') : ''
        }
        case 'devise': {
          /* Le serveur écrit un code ISO — `XAF` — que l'écran ne montre nulle
             part ailleurs : il réunit les deux francs sous « FCFA ». */
          const code = ({ XAF: 'CFA', XOF: 'CFA', EUR: 'EUR', CAD: 'CAD', USD: 'USD' } as const)[
            valeur as 'XAF'
          ]
          return code ? CURRENCY_DEFS[code].label : ''
        }
        case 'piece':
          /* « Quittance » ou « Reçu » : le serveur seul tranche, et le mot
             qu'il a choisi est ce que le locataire a reçu. */
          return valeur === 'quittance' || valeur === 'recu'
            ? t(`app.receipts.${valeur}` as 'app.receipts.quittance')
            : ''
      }
    })

    return morceaux.filter(Boolean).join(' · ')
  }

  const libelle = (action: string) => {
    const cle = `app.decisions.actions.${action}` as 'app.decisions.actions.unknown'
    const rendu = t(cle)
    return rendu === cle ? t('app.decisions.actions.unknown') : rendu
  }

  if (chargement)
    return (
      <>
        <PageHeader title={t('app.decisions.title')} description={t('app.decisions.subtitle')} />
        <SkeletonRegion label={t('app.decisions.title')}>
          <SkeletonTable rows={6} />
        </SkeletonRegion>
      </>
    )

  return (
    <>
      <PageHeader title={t('app.decisions.title')} description={t('app.decisions.subtitle')} />

      {erreur && <Notice tone="danger">{t('app.decisions.failed')}</Notice>}

      {!erreur && (registre?.length ?? 0) === 0 ? (
        <EmptyState
          icon="clipboard"
          title={t('app.decisions.empty')}
          body={t('app.decisions.emptyHint')}
        />
      ) : (
        <>
          <DataTable<DecisionApi>
            caption={t('app.decisions.title')}
            fiches
            rows={registre ?? []}
            rowKey={(decision) => decision.id}
            columns={[
              {
                key: 'when',
                header: t('app.decisions.colWhen'),
                /* LA DATE EN PREMIER, parce qu'un registre se lit comme une
                   chronologie : c'est la colonne qui donne le rythme, et la
                   déplacer à droite obligerait à balayer chaque ligne. */
                render: (decision) => (
                  <span className="text-muted">{d.fullDate(partiesDeDateISO(decision.at))}</span>
                ),
              },
              {
                key: 'what',
                header: t('app.decisions.colWhat'),
                /* LE DÉTAIL SOUS L'ACTION, et non dans une quatrième colonne :
                   il n'existe pas pour toutes les décisions, et une colonne à
                   moitié vide se lit comme une donnée manquante. Sous le
                   libellé, son absence ne se voit pas — c'est le motif des
                   lignes d'alerte du tableau de bord. */
                render: (decision) => {
                  const quoi = detail(decision)
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{libelle(decision.action)}</span>
                      {quoi && <span className="text-caption text-muted">{quoi}</span>}
                    </div>
                  )
                },
              },
              {
                key: 'who',
                header: t('app.decisions.colWho'),
                /* UN ACTEUR NUL SE DIT. `actorId` est en `SetNull` pour que le
                   registre survive à la suppression d'un compte : une décision
                   dont l'auteur est parti reste une décision prise, et la
                   masquer effacerait l'histoire pour protéger un nom qui
                   n'existe plus. */
                render: (decision) =>
                  decision.actor ?? (
                    <span className="text-muted">{t('app.decisions.unknownActor')}</span>
                  ),
              },
            ]}
          />

          {suivant && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => void suite()} disabled={enSuite}>
                {t('app.decisions.more')}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
