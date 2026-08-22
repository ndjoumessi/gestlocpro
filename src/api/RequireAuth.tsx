import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './SessionProvider'
import { useT } from '@/i18n/I18nProvider'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'

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
  const { etat, horsLigne, echecDeSession, reprendreLaSession } = useSession()
  const location = useLocation()

  /**
   * TROIS ÉTATS TERMINAUX, et plus aucune attente sans fin.
   *
   * L'ordre compte : `horsLigne` d'abord, parce qu'il dit quelque chose de plus
   * précis que « ça a raté » — la session est peut-être encore valable, et le
   * geste à proposer n'est pas le même. `echecDeSession` ensuite : le serveur a
   * répondu de travers, ou n'a rien dit à temps. `Attente` en dernier, et c'est
   * désormais un état de PASSAGE borné par le délai du fournisseur, plus une
   * impasse.
   */
  if (etat.statut === 'inconnu') {
    if (horsLigne) return <ServeurInjoignable reprendre={reprendreLaSession} />
    if (echecDeSession) return <EchecDeLaSession genre={echecDeSession} reprendre={reprendreLaSession} />
    return <Attente />
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

/**
 * Attente de la première réponse du serveur — AVEC UNE SORTIE.
 *
 * Elle n'en avait aucune : un `<p>` seul, zéro titre, zéro élément interactif.
 * Mesuré sur le paquet réel, appel qui pend : « Chargement… » toujours à
 * l'écran après 45 secondes, sans rien à toucher. Sur le marché visé, c'est
 * l'écran d'échec le plus probable du produit, et il enfermait.
 *
 * LA SORTIE EST LÀ DÈS LE PREMIER INSTANT, et non après un délai. La faire
 * apparaître au bout de quelques secondes aurait demandé une minuterie de plus,
 * un état de plus, et surtout aurait laissé l'utilisateur sans issue pendant
 * exactement le moment où il se demande s'il est bloqué. Elle ne coûte rien :
 * un lien qui ne sert pas ne se remarque pas, un lien absent se paie en écran
 * fermé.
 */
function Attente() {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-5">
      {/* `aria-live` : la bascule vers l'écran suivant est silencieuse sans
          cela, et un lecteur d'écran n'annonce rien pendant l'attente. */}
      <p aria-live="polite" className="text-body text-muted">
        {t('common.loading')}
      </p>
      <Button to="/" variant="ghost" size="sm">
        {t('common.backToHome')}
      </Button>
    </div>
  )
}

/**
 * L'ÉCHEC TERMINAL de la première lecture : le serveur a répondu de travers, ou
 * n'a rien dit à temps.
 *
 * DEUX PHRASES POUR DEUX CAUSES, et ce n'est pas de la cosmétique : dire « le
 * serveur a rencontré une erreur » quand il n'a rien dit du tout serait inventer
 * une cause, et envoyer quelqu'un chercher une panne qui n'existe pas. Le geste,
 * lui, est le même — et il est DÉCLENCHÉ PAR L'UTILISATEUR. Une reprise
 * automatique en boucle dépenserait les données de quelqu'un sur un forfait
 * compté, sans jamais le lui demander.
 */
function EchecDeLaSession({
  genre,
  reprendre,
}: {
  genre: 'technique' | 'delai'
  reprendre: () => void
}) {
  const t = useT()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="max-w-md text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger">
          <Icon name="alert" size={22} />
        </span>
        <h1 className="mt-4 title-l">{t('app.sessionFailure.title')}</h1>
        <p className="mt-2 text-body text-muted">
          {genre === 'delai' ? t('app.sessionFailure.timeoutBody') : t('app.sessionFailure.body')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reprendre}>{t('common.retry')}</Button>
          <Button to="/" variant="ghost">
            {t('common.backToHome')}
          </Button>
        </div>
      </div>
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
function ServeurInjoignable({ reprendre }: { reprendre: () => void }) {
  const t = useT()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="max-w-md text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-warn-tint text-warn">
          <Icon name="alert" size={22} />
        </span>
        <h1 className="mt-4 title-l">{t('app.offline.title')}</h1>
        <p className="mt-2 text-body text-muted">{t('app.offline.body')}</p>
        {/* Il était TERMINAL mais FERMÉ : un titre, un paragraphe, et rien à
            toucher — mesuré, zéro élément interactif. « Rechargez la page », que
            dit son texte, demandait un geste de navigateur pour un problème
            d'application. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reprendre}>{t('common.retry')}</Button>
          <Button to="/" variant="ghost">
            {t('common.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
