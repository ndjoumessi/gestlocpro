import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, EmptyState } from '@/components/primitives/DataTable'
import { Button } from '@/components/primitives/Button'
import { Notice } from '@/components/primitives/Notice'
import { SkeletonRegion, SkeletonTable } from '@/components/primitives/Skeleton'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
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
                render: (decision) => <span className="font-medium">{libelle(decision.action)}</span>,
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
