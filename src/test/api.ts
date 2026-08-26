import { vi } from 'vitest'

/**
 * Faux serveur pour les tests.
 *
 * Sans lui, monter l'application appelle `/api/auth/me` dès le premier rendu,
 * et jsdom ne sait pas répondre : les 245 tests existants — écrits quand aucun
 * serveur n'existait — se mettraient à dépendre d'un processus en cours
 * d'exécution. Un test qui exige une base de données n'est plus un test
 * unitaire, c'est un test d'intégration déguisé, et il tombe sur la machine de
 * quelqu'un d'autre.
 *
 * L'état par défaut est **authentifié**, et ce choix mérite d'être expliqué :
 * l'immense majorité des cas montent un écran de `/app`, désormais gardé par
 * `RequireAuth`. Un défaut anonyme les redirigerait tous vers la connexion, et
 * soixante-seize tests parleraient d'un formulaire au lieu de l'écran qu'ils
 * examinent. Les rares cas qui ont besoin d'un visiteur le demandent.
 */

/** Compte fictif renvoyé par les routes d'authentification. */
export const COMPTE_FICTIF = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'sarah@example.com',
  fullName: 'Sarah Ngassa',
  locale: 'fr' as const,
  countryCode: 'CM',
  phoneE164: '+237677214408',
}

export interface FauxServeur {
  /** Programme la réponse d'une route, une fois ou durablement. */
  quand: (methode: string, chemin: string, reponse: { status: number; body?: unknown }) => void
  /**
   * Programme une réponse et la RETIENT jusqu'à ce qu'on la relâche. Rend la
   * fonction qui la relâche. Voir le commentaire de `barrages`, plus bas.
   */
  retenir: (
    methode: string,
    chemin: string,
    reponse: { status: number; body?: unknown },
  ) => () => void
  /** Requêtes reçues, dans l'ordre — pour vérifier qu'un appel a bien eu lieu. */
  appels: { methode: string; chemin: string; corps: unknown }[]
}

export function installerFauxServeur(
  options: { authentifie?: boolean } = {},
): FauxServeur {
  const { authentifie = true } = options
  const routes = new Map<string, { status: number; body?: unknown }>()
  const appels: FauxServeur['appels'] = []

  /**
   * LES RÉPONSES RETENUES, et pourquoi le harnais en a besoin.
   *
   * UN TEST QUI OBSERVE UNE ATTENTE DOIT LA TENIR, pas la parier. `renderApp`
   * est devenue asynchrone au découpage paresseux (`85e12e0`) : elle attend
   * désormais que la frontière `Suspense` de `/app` se résolve, c'est-à-dire
   * l'instant EXACT où l'écran se monte et lance son `fetch`. Les deux chaînes
   * — la résolution du module et celle de la requête — partent donc ensemble, et
   * un test qui assertait « le squelette est là » juste après `await renderApp`
   * assertait en réalité leur ORDRE D'ARRIVÉE.
   *
   * Mesuré avant ce lot, sur le premier cas de `registreDesAcces.test.tsx` :
   * 3 échecs sur 40 passages du fichier seul, 3 sur 20 de la suite complète.
   * Une sonde posée au même point a rendu le verdict : 4 fois sur 60, le DOM
   * portait DÉJÀ les lignes du registre là où le cas attendait le squelette.
   * Zéro fois sur 120 quand le paquet paresseux était déjà en cache — c'est le
   * PREMIER cas d'un fichier qui est exposé, celui dont l'import dynamique est
   * réel. Aux mêmes 40 passages sur `0e4684d`, juste avant le découpage :
   * zéro échec, `renderApp` y étant synchrone.
   *
   * ON NE RALENTIT PAS, ON RETIENT. Un `setTimeout` de 200 ms — le procédé que
   * `chargement.test.tsx` emploie encore — déplace le pari sans le supprimer :
   * il tient tant que la machine n'est pas chargée, et c'est précisément sous
   * charge que la suite complète double son taux d'échec. Une promesse que le
   * test ouvre et ferme lui-même ne dépend d'aucune horloge : il n'y a plus
   * d'ordre à deviner, il y en a un à décider.
   */
  const barrages = new Map<string, Promise<void>>()

  routes.set(
    'GET /auth/me',
    authentifie
      ? { status: 200, body: { user: COMPTE_FICTIF, memberships: [] } }
      : { status: 401, body: { error: 'unauthenticated' } },
  )

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
      const url = typeof entree === 'string' ? entree : entree.toString()
      const methode = (init?.method ?? 'GET').toUpperCase()
      const chemin = url.replace(/^\/api/, '')
      /**
       * TOUT CORPS N'EST PAS DU JSON, depuis que le produit envoie des images.
       *
       * `JSON.parse(String(body))` lançait sur un `Blob` — `String(blob)` rend
       * « [object Blob] » —, et l'exception partait AVANT l'enregistrement de
       * l'appel : la requête devenait invisible à la double, qui répondait
       * comme si elle n'avait jamais eu lieu. Un dépôt de photo se comportait
       * donc en test comme un échec réseau, quel que soit ce que le cas avait
       * programmé.
       *
       * Le corps binaire est gardé TEL QUEL : un test qui veut le peser ou
       * vérifier son type le peut, et aucun ne se met à parler de JSON là où
       * il n'y en a pas.
       */
      const corps =
        init?.body === undefined || init?.body === null
          ? undefined
          : typeof init.body === 'string'
            ? JSON.parse(init.body)
            : init.body
      appels.push({ methode, chemin, corps })

      // L'appel est ENREGISTRÉ AVANT la retenue : un test doit pouvoir vérifier
      // que la requête est bien partie pendant qu'il la tient encore. Et la
      // réponse n'est lue qu'APRÈS, pour qu'un `quand` posé pendant la retenue
      // — le cas d'un écran qu'on veut voir relire autre chose — s'applique.
      const barrage = barrages.get(`${methode} ${chemin}`)
      if (barrage) await barrage

      const programmee = routes.get(`${methode} ${chemin}`)
      if (!programmee) {
        // Une route non programmée rend 404 plutôt que de lever : le test
        // échoue alors sur l'assertion qui l'intéresse, et non sur une
        // exception réseau qui masquerait la cause.
        return new Response(JSON.stringify({ error: 'not_found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(programmee.body === undefined ? null : JSON.stringify(programmee.body), {
        status: programmee.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  return {
    quand: (methode, chemin, reponse) => routes.set(`${methode.toUpperCase()} ${chemin}`, reponse),
    retenir: (methode, chemin, reponse) => {
      const cle = `${methode.toUpperCase()} ${chemin}`
      routes.set(cle, reponse)
      let ouvrir!: () => void
      barrages.set(
        cle,
        new Promise<void>((resoudre) => {
          ouvrir = resoudre
        }),
      )
      // Le barrage est RETIRÉ en plus d'être ouvert : sans cela, une seconde
      // requête sur la même route — la relecture qui suit un geste — attendrait
      // une promesse déjà résolue, ce qui marche, mais laisserait croire que la
      // retenue vaut pour une seule requête alors qu'elle vaut pour la route.
      return () => {
        barrages.delete(cle)
        ouvrir()
      }
    },
    appels,
  }
}
