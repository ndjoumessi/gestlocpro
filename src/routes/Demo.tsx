import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/api/SessionProvider'

/**
 * Entrée dans la démonstration.
 *
 * Cette route ne rend rien : elle marque la visite puis renvoie vers `/app`.
 *
 * Pourquoi pas un préfixe `/demo/...` portant toute l'application ? Parce que
 * les chemins `/app/…` sont écrits en dur dans une vingtaine d'endroits — barre
 * latérale, tableau de bord, boutons de renvoi. Les rendre relatifs à une base
 * variable serait un remaniement large, risqué, et pour un seul bénéfice :
 * l'adresse affichée. Le visiteur voit `/app`, ce qui est exactement l'endroit
 * où il se trouve ; le bandeau lui dit que les données sont fictives.
 */
export function Demo() {
  const { entrerEnDemo, estDemo } = useSession()

  useEffect(() => {
    if (!estDemo) entrerEnDemo()
  }, [estDemo, entrerEnDemo])

  // Tant que l'état n'est pas posé, rediriger ferait rebondir la barrière vers
  // la connexion — elle ne saurait pas encore qu'il s'agit d'une visite.
  if (!estDemo) return null

  return <Navigate to="/app" replace />
}
