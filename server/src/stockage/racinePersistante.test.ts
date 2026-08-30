import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * EN PRODUCTION, LE STOCKAGE DIT OÙ IL ÉCRIT — ou le serveur ne démarre pas.
 *
 * ═══ LE DÉFAUT, ET IL DÉTRUISAIT VRAIMENT ═══
 *
 * `StockageLocal` écrivait dans `resolve(process.cwd(), '.stockage-local')`,
 * c'est-à-dire DANS le conteneur. Aucun volume n'est monté sur le service : ce
 * répertoire est effacé à chaque redéploiement, à chaque redémarrage, à chaque
 * arbitrage de la plateforme. Les photos d'un état des lieux — la preuve qu'un
 * locataire verse pour ne pas payer une dégradation qu'il n'a pas faite —
 * vivaient donc jusqu'au prochain lot.
 *
 * Rien ne le disait. Le produit fonctionnait parfaitement : l'envoi réussit, la
 * vignette s'affiche, la page se recharge et l'image est là. Elle n'est plus là
 * une semaine après, et personne ne sait pourquoi. C'est la forme de panne que
 * ce dépôt reproche partout ailleurs — celle qui ne se voit pas.
 *
 * ═══ POURQUOI UNE VARIABLE EXIGÉE, ET NON UN CHEMIN CODÉ ═══
 *
 * Le code ne peut PAS savoir si un chemin est persistant : `/data` monté et
 * `/data` créé à la volée sont indiscernables depuis l'intérieur du conteneur.
 * Ce qu'on peut exiger, c'est que quelqu'un l'ait DÉCLARÉ — et le refus de
 * démarrer transforme un oubli silencieux en une panne bruyante, au
 * déploiement, avant qu'un seul fichier ne soit écrit.
 *
 * C'est exactement la règle qu'`env.ts` s'impose déjà dans son en-tête : « la
 * moindre variable absente ou mal formée empêche le démarrage, avec le nom du
 * champ fautif », et le refus du secret d'exemple hors développement en est le
 * précédent direct.
 *
 * ═══ CE QUE CE CONTRÔLE NE DIT PAS ═══
 *
 * Que le chemin déclaré soit RÉELLEMENT un volume. Il ne le peut pas, et
 * prétendre le contraire serait pire que se taire : un contrôle qui vérifierait
 * l'existence du répertoire passerait au vert sur un `/data` éphémère créé par
 * le premier écrit. Ce qui est tenu ici est la DÉCLARATION ; le montage se
 * vérifie une fois, à la main, en redéployant et en relisant un fichier.
 */

// `env.ts` charge `.env` à son import ; ce fichier lit l'environnement AVANT
// que cela n'arrive, et doit donc disposer de `DATABASE_URL` par lui-même.
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

const originaux = { ...process.env }

afterEach(() => {
  process.env = { ...originaux }
  vi.resetModules()
})

/** Recharge `env.ts` et `stockage.ts` sous un environnement choisi. */
async function chargerSous(variables: Record<string, string | undefined>) {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
  for (const [nom, valeur] of Object.entries(variables)) {
    if (valeur === undefined) delete process.env[nom]
    else process.env[nom] = valeur
  }
  return import('./stockage.js')
}

describe('la racine du stockage est déclarée en production', () => {
  it('refuse de démarrer sans `STOCKAGE_RACINE`', async () => {
    await expect(chargerSous({ STOCKAGE_RACINE: undefined })).rejects.toThrow(/STOCKAGE_RACINE/)
  })

  it('écrit là où la variable le dit', async () => {
    const module = await chargerSous({ STOCKAGE_RACINE: '/data/stockage' })
    expect(module.racineDuStockage()).toBe('/data/stockage')
  })

  it('retombe sur le répertoire local hors production', async () => {
    /**
     * La contrepartie, et elle n'est pas négociable : un dépôt fraîchement
     * cloné doit marcher sans un secret ni une variable. C'est la règle que
     * `choisirLeStockage` écrit déjà pour le repli local — « il doit marcher
     * sans un secret » — et l'exigence ci-dessus ne vaut donc qu'en production.
     */
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    delete process.env.STOCKAGE_RACINE
    const module = await import('./stockage.js')
    expect(module.racineDuStockage()).toMatch(/\.stockage-local$/)
  })
})
