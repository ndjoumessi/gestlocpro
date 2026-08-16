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
 * Le défaut par défaut est **anonyme** : c'est l'état d'un visiteur, et c'est
 * ce que la quasi-totalité des cas suppose implicitement.
 */

export interface FauxServeur {
  /** Programme la réponse d'une route, une fois ou durablement. */
  quand: (methode: string, chemin: string, reponse: { status: number; body?: unknown }) => void
  /** Requêtes reçues, dans l'ordre — pour vérifier qu'un appel a bien eu lieu. */
  appels: { methode: string; chemin: string; corps: unknown }[]
}

export function installerFauxServeur(): FauxServeur {
  const routes = new Map<string, { status: number; body?: unknown }>()
  const appels: FauxServeur['appels'] = []

  // Anonyme par défaut : `/auth/me` répond 401, comme pour un visiteur.
  routes.set('GET /auth/me', { status: 401, body: { error: 'unauthenticated' } })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
      const url = typeof entree === 'string' ? entree : entree.toString()
      const methode = (init?.method ?? 'GET').toUpperCase()
      const chemin = url.replace(/^\/api/, '')
      const corps = init?.body ? JSON.parse(String(init.body)) : undefined
      appels.push({ methode, chemin, corps })

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
    appels,
  }
}

/** Compte fictif renvoyé par les routes d'authentification. */
export const COMPTE_FICTIF = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'sarah@example.com',
  fullName: 'Sarah Ngassa',
  locale: 'fr' as const,
  countryCode: 'CM',
  phoneE164: '+237677214408',
}
