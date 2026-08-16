import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/api/SessionProvider'
import { AppShell } from '@/components/layout/AppShell'

/**
 * La démonstration, sous sa propre adresse.
 *
 * Elle a d'abord vécu sous `/app`, signalée par un bandeau ambre et par « Parc
 * de démonstration » sous le logo. Cela n'a pas suffi : l'auteur du produit l'a
 * prise **deux fois** pour son espace dans la même après-midi, et a conclu
 * chaque fois que son compte était créé. Un avertissement se lit ; une adresse
 * se regarde.
 *
 * Ce composant remplace la barrière d'accès. Il n'accorde aucun droit — le
 * serveur ignore cet état et refuse toute requête authentifiée. Les données
 * affichées sont le jeu de démonstration, qui n'appartient à personne.
 */
export function Demo() {
  const { entrerEnDemo, estDemo, etat } = useSession()

  useEffect(() => {
    if (etat.statut === 'connecte') return
    if (!estDemo) entrerEnDemo()
  }, [etat.statut, estDemo, entrerEnDemo])

  /**
   * Un compte réel ne visite pas la démonstration : on le ramène chez lui.
   *
   * Sans cela, quelqu'un qui suit un vieux lien `/demo` verrait le jeu fictif
   * alors qu'il a des données réelles — exactement la confusion que cette
   * adresse existe pour empêcher, mais dans l'autre sens.
   */
  if (etat.statut === 'connecte') return <Navigate to="/app" replace />

  // Le temps que l'état se pose. Rendre la coquille avant ferait clignoter un
  // écran sans son bandeau.
  if (!estDemo) return null

  return <AppShell />
}
