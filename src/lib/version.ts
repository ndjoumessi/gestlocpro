import { useEffect, useState } from 'react'

/**
 * Détecter qu'une nouvelle version est en ligne.
 *
 * Une application React ne recharge pas son code en naviguant : un onglet
 * ouvert avant un déploiement garde le sien indéfiniment. Un défaut corrigé et
 * déployé reste alors à l'écran, et l'utilisateur constate que rien n'a changé
 * — ce qui est exact de son point de vue, et incompréhensible du nôtre. Une
 * après-midi entière y est passée : plusieurs allers-retours ont porté sur du
 * code déjà remplacé.
 *
 * La version est le NOM du paquet, que Vite hache d'après son contenu. Rien à
 * incrémenter, rien à oublier : deux constructions différentes portent des noms
 * différents, deux constructions identiques le même. Un numéro tenu à la main
 * aurait fini par mentir.
 */

/**
 * Le nom du paquet qui exécute ce code.
 *
 * `import.meta.url` désigne le module courant. Construit, c'est
 * `…/assets/index-XXXX.js` ; en développement, un chemin source — d'où le
 * repli à `null`, qui désactive la comparaison là où elle n'a pas de sens.
 */
export function paquetCourant(): string | null {
  return /\/(index-[A-Za-z0-9_-]+\.js)/.exec(import.meta.url)?.[1] ?? null
}

/** Toutes les cinq minutes : assez pour prévenir, trop rare pour peser. */
const PERIODE_MS = 5 * 60 * 1000

/**
 * Rend `true` quand le serveur sert un autre paquet que celui qui tourne.
 *
 * La vérification se fait aussi au retour sur l'onglet : c'est le moment où
 * l'on reprend son travail, et le meilleur pour apprendre qu'il faut recharger
 * — bien plus utile qu'au milieu d'une saisie.
 */
export function useNouvelleVersion(): boolean {
  const [perime, setPerime] = useState(false)

  useEffect(() => {
    const mien = paquetCourant()
    // En développement il n'y a pas de paquet haché : rien à comparer, et le
    // rechargement à chaud fait déjà le travail.
    if (!mien) return

    let vivant = true

    const verifier = async () => {
      try {
        const reponse = await fetch('/api/version', { cache: 'no-store' })
        if (!reponse.ok) return
        const { paquet } = (await reponse.json()) as { paquet: string | null }
        // `null` : le serveur ne sait pas ce qu'il sert. On ne conclut pas —
        // annoncer une mise à jour inexistante userait l'avertissement, et un
        // avertissement usé ne se lit plus.
        if (vivant && paquet && paquet !== mien) setPerime(true)
      } catch {
        // Hors ligne, ou serveur en cours de redéploiement. Ce n'est pas le
        // sujet de cette fonction, et l'échec est sans conséquence.
      }
    }

    void verifier()
    const minuterie = setInterval(() => void verifier(), PERIODE_MS)
    const auRetour = () => {
      if (document.visibilityState === 'visible') void verifier()
    }
    document.addEventListener('visibilitychange', auRetour)

    return () => {
      vivant = false
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [])

  return perime
}
