import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './SessionProvider'
import { useT } from '@/i18n/I18nProvider'
import { Icon } from '@/components/primitives/Icon'

/**
 * Barrière d'accès aux écrans applicatifs.
 *
 * Elle ne remplace pas le cloisonnement du serveur, elle le double : la véritable
 * protection est le prédicat de chaque requête, et laisser un visiteur atteindre
 * `/app` ne lui donnerait de toute façon aucune donnée. Ce qu'elle évite est
 * autre chose — une coquille vide, des écrans qui échouent un à un, et
 * l'impression d'une application cassée là où il manque simplement une
 * connexion.
 *
 * **Trois états, et le troisième est celui qu'on oublie.** Entre le montage et
 * la réponse de `/auth/me`, on ne sait pas encore. Rediriger pendant ce
 * moment-là éjecte vers la connexion un utilisateur parfaitement authentifié, à
 * chaque rechargement de page — un défaut qui ne se reproduit pas sur une
 * machine rapide et se manifeste chez tout le monde sur le réseau réel.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { etat, horsLigne } = useSession()
  const location = useLocation()

  if (etat.statut === 'inconnu') {
    return horsLigne ? <ServeurInjoignable /> : <Attente />
  }

  /**
   * La démonstration NE passe PAS ici — elle a son adresse.
   *
   * Elle a d'abord traversé cette barrière, et l'application s'affichait alors
   * sous `/app` avec des données fictives. L'auteur du produit s'y est trompé
   * deux fois dans la même après-midi : l'adresse annonçait son espace, le
   * contenu ressemblait à son espace, seul un bandeau disait le contraire.
   *
   * `/app` signifie donc « un vrai compte », sans exception. Un visiteur en
   * démonstration qui atteint cette adresse est renvoyé à la connexion comme
   * n'importe quel anonyme — ce qu'il est.
   */
  if (etat.statut === 'anonyme' || etat.statut === 'demo') {
    /**
     * L'adresse demandée voyage dans l'état de navigation.
     *
     * Sans elle, quelqu'un qui ouvre un lien vers `/app/cautions` atterrit sur
     * le tableau de bord après s'être connecté, et doit refaire le chemin. Le
     * `replace` évite d'empiler la page protégée dans l'historique : le bouton
     * « retour » du navigateur y renverrait, pour être redirigé à nouveau.
     */
    return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}

/** Attente de la première réponse du serveur. */
function Attente() {
  const t = useT()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      {/* `aria-live` : la bascule vers l'écran suivant est silencieuse sans
          cela, et un lecteur d'écran n'annonce rien pendant l'attente. */}
      <p aria-live="polite" className="text-body text-muted">
        {t('common.loading')}
      </p>
    </div>
  )
}

/**
 * Serveur injoignable.
 *
 * Distinct de « déconnecté », et la distinction commande le geste : renvoyer
 * vers la connexion demanderait à quelqu'un de ressaisir son mot de passe pour
 * une coupure de deux secondes, et le formulaire échouerait de la même façon.
 */
function ServeurInjoignable() {
  const t = useT()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="max-w-md text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-warn-tint text-warn">
          <Icon name="alert" size={22} />
        </span>
        <h1 className="mt-4 font-sans text-title-l font-semibold">{t('app.offline.title')}</h1>
        <p className="mt-2 text-body text-muted">{t('app.offline.body')}</p>
      </div>
    </div>
  )
}
