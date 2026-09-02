import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * L'HÔTE QUI PORTE VRAIMENT L'APPLICATION, quand ce n'est pas celui-ci.
 *
 * Vide partout sauf sur la vitrine : c'est une variable de CONSTRUCTION, et le
 * paquet de production ne la porte pas. Rien de ce fichier ne s'exécute là-bas.
 *
 * UNE FONCTION ET NON UNE CONSTANTE : une constante de module est évaluée à
 * l'import, donc AVANT que quoi que ce soit puisse la poser — et la garde de ce
 * lot, qui la pose par `stubEnv`, ne voyait que la valeur figée. Le lire au
 * rendu ne coûte rien et rend le mécanisme éprouvable, ce qu'une constante
 * n'était pas.
 */
export function hoteApplicatif(): string {
  return import.meta.env.VITE_HOTE_APPLICATIF ?? ''
}

/**
 * RENVOIE VERS L'HÔTE APPLICATIF, ET NE REND RIEN.
 *
 * ═══ POURQUOI LES REDIRECTIONS DU BORD NE SUFFISENT PAS ═══
 *
 * `vercel.json` renvoie `/connexion`, `/inscription` et `/app` vers l'hôte
 * applicatif. Ces règles ne s'exécutent qu'à une VRAIE requête HTTP — et React
 * Router change l'adresse sans jamais toucher le bord. Cliquer « Se connecter »
 * depuis la vitrine rendait donc le formulaire, sur un hôte où
 * `/api/auth/login` n'existe pas. Seul un rafraîchissement déclenchait la
 * redirection, ce qui donnait le comportement le plus déroutant qui soit : la
 * page marche, puis change d'adresse quand on la recharge.
 *
 * CE N'ÉTAIT PAS SEULEMENT INUTILE. Un gestionnaire de mots de passe associe un
 * formulaire d'identification à l'ORIGINE qui l'affiche : laisser la vitrine en
 * montrer un lui apprend un mot de passe sur la mauvaise adresse, et le lui
 * fera proposer là ensuite.
 *
 * ═══ `replace`, ET NON `assign` ═══
 *
 * Le renvoi ne doit pas laisser d'entrée dans l'historique : « précédent »
 * ramènerait sur la page qu'on vient de quitter, qui renverrait de nouveau — une
 * boucle dont on ne sort qu'en fermant l'onglet.
 *
 * ═══ LE CHEMIN COMPLET ═══
 *
 * `/inscription/proprietaire` est un lien de la vitrine ; renvoyer sur
 * `/inscription` ferait recommencer le choix du rôle à quelqu'un qui l'a déjà
 * fait. La recherche suit aussi — `/reinitialiser?token=…` n'est rien sans elle.
 */
export function RenvoiVersLApplication() {
  const emplacement = useLocation()
  useEffect(() => {
    location.replace(`${hoteApplicatif()}${emplacement.pathname}${emplacement.search}`)
  }, [emplacement.pathname, emplacement.search])
  return null
}
