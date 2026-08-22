import { Outlet } from 'react-router-dom'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useT } from '@/i18n/I18nProvider'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'

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
 */
export function CadreDuParc() {
  const { echecDuParc, reprendreLeParc } = usePortfolio()
  const t = useT()

  if (!echecDuParc) return <Outlet />

  const session = echecDuParc === 'session'
  return (
    <section
      // `aria-live` : la bascule est silencieuse sans cela, et quelqu'un qui
      // lit à la voix ne saurait pas que l'écran a cessé de charger.
      aria-live="polite"
      className="mx-auto max-w-md py-10 text-center"
    >
      <span
        className={
          session
            ? 'inline-flex size-12 items-center justify-center rounded-full bg-warn-tint text-warn'
            : 'inline-flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger'
        }
      >
        <Icon name="alert" size={22} />
      </span>
      {/*  et non  : quand le chargement échoue, ce texte EST le titre
          principal de la page — l'écran qu'il remplace emportait le sien. Le
          laisser en  retirait son  à l'écran, et le dépôt en comptait
          zéro jusqu'ici (mesuré au lot 0, sur les 23 routes). */}
      <h1 className="mt-4 title-l">
        {session ? t('app.parkFailure.sessionTitle') : t('app.parkFailure.title')}
      </h1>
      <p className="mt-2 text-body text-muted">
        {session ? t('app.parkFailure.sessionBody') : t('app.parkFailure.body')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {/*
          Deux gestes distincts pour deux causes. Sur une session expirée,
          « Réessayer » relirait le parc avec le même cookie périmé et
          échouerait pareil : le geste utile est d'aller se reconnecter — par un
          LIEN, que l'utilisateur suit quand il veut, et non par une redirection
          qui l'emporte au milieu d'une saisie.
        */}
        {session ? (
          <Button to="/connexion">{t('app.parkFailure.signIn')}</Button>
        ) : (
          <Button onClick={reprendreLeParc}>{t('common.retry')}</Button>
        )}
      </div>
    </section>
  )
}
