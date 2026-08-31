import { Outlet } from 'react-router-dom'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { SansParc } from '@/features/dashboard/SansParc'
import { useT } from '@/i18n/I18nProvider'
import { Button } from '@/components/primitives/Button'
import { EcranSysteme } from './EcranSysteme'

/**
 * L'ÉCHEC DU CHARGEMENT DU PARC, RENDU DANS LE CADRE DE CE QUI A ÉCHOUÉ.
 *
 * PAS PLEIN ÉCRAN, et c'est une décision prise contre le précédent. La frontière
 * d'erreur du lot précédent remplace la page entière, en connaissance de cause :
 * un arbre React démonté n'a plus de coquille à conserver. Ici, la coquille va
 * parfaitement bien — la navigation, l'en-tête, le sélecteur de parc et de
 * langue sont montés et fonctionnels. Seules les DONNÉES manquent. Rendre
 * l'erreur plein cadre transformerait une requête ratée en perte de tout
 * l'écran, et retirerait à l'utilisateur les commandes qui lui permettent
 * justement de s'en sortir — changer de parc, se déconnecter, aller ailleurs.
 *
 * ON NE REDIRIGE PAS, MÊME SUR 401, et c'est l'échange central de ce lot.
 * Mesuré avant correctif : une session expirée en cours d'usage ne provoquait
 * AUCUNE navigation — l'adresse restait `/app`, l'écran restait monté. Rien
 * n'était donc perdu. Ajouter une redirection automatique vers la connexion
 * aurait CRÉÉ la perte : sur un réseau lent et un forfait compté, jeter un
 * formulaire à moitié rempli coûte plus cher que l'écran d'erreur qu'on
 * remplace. L'utilisateur est donc informé et OUTILLÉ ; c'est lui qui décide de
 * partir se reconnecter, quand il a fini ce qu'il faisait.
 *
 * Corollaire : la question « trois requêtes qui rendent 401 ensemble
 * déclenchent-elles trois redirections ? » n'a pas d'objet ici — il n'y en a
 * aucune. Et l'état lui-même est idempotent, voir le `catch` du fournisseur.
 *
 * L'`aria-live="polite"` qui vivait ici est parti pour le FOCUS SUR LE TITRE,
 * que `EcranSysteme` pose pour les quatre écrans système d'un coup. La raison
 * écrite alors — « la bascule est silencieuse sans cela » — reste la bonne ;
 * c'est le remède qui a changé, et son en-tête dit pourquoi.
 */
export function CadreDuParc() {
  const { echecDuParc, reprendreLeParc } = usePortfolio()
  const { etat, estDemo, sessionResolue } = useSession()
  const t = useT()

  /**
   * AUCUN PARC : on ne rend AUCUN écran de gestion, et c'est la seule réponse
   * honnête.
   *
   * Ce cadre existe pour distinguer « la coquille va bien » de « les données
   * manquent ». Ici les données ne manquent pas : elles n'existent pas, et le
   * fournisseur laissait à leur place son jeu de démonstration — voir
   * `SansParc`, qui porte le récit complet.
   *
   * Le contrôle est ici plutôt que dans chaque écran : un compte sans parc n'a
   * pas UN écran vide, il n'en a aucun, et le dire vingt fois finirait par
   * diverger. `estDemo` protège la démonstration, qui n'a jamais de `parkId` et
   * dont le jeu est précisément le propos.
   */
  if (
    !estDemo &&
    /* Reçu du SERVEUR, et non posé par défaut : voir `sessionResolue`. Une
       liste d'adhésions vide qu'on n'a pas demandée ne dit rien. */
    sessionResolue &&
    etat.statut === 'connecte' &&
    etat.adhesions.length === 0
  )
    return <SansParc />

  if (!echecDuParc) return <Outlet />

  const session = echecDuParc === 'session'
  return (
    <EcranSysteme
      dansLaCoquille
      ton={session ? 'warn' : 'danger'}
      titre={session ? t('app.parkFailure.sessionTitle') : t('app.parkFailure.title')}
      corps={session ? t('app.parkFailure.sessionBody') : t('app.parkFailure.body')}
      actions={
        /*
          Deux gestes distincts pour deux causes. Sur une session expirée,
          « Réessayer » relirait le parc avec le même cookie périmé et échouerait
          pareil : le geste utile est d'aller se reconnecter — par un LIEN, que
          l'utilisateur suit quand il veut, et non par une redirection qui
          l'emporte au milieu d'une saisie.
        */
        session ? (
          <Button to="/connexion">{t('app.parkFailure.signIn')}</Button>
        ) : (
          <Button onClick={reprendreLeParc}>{t('common.retry')}</Button>
        )
      }
    />
  )
}
