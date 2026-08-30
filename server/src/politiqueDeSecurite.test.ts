import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { empreintesDesScriptsEnLigne, politiqueDeSecurite } from './politiqueDeSecurite.js'
import { rendreLEnvironnementIntact } from './test/environnementRendu.js'

/**
 * LA POLITIQUE SE CALCULE JUSTE — éprouvé sans navigateur ni serveur.
 *
 * `scripts/politique-de-securite.mjs` mesure l'autre moitié : qu'aucun écran
 * n'est cassé par cette politique, derrière le vrai serveur. Il lui faut
 * Chromium et un client construit. Ces cas-ci tiennent en quelques
 * millisecondes et gardent la partie qui peut se tromper en silence : l'EMPREINTE.
 *
 * Une empreinte fausse ne casse rien à la construction. Elle casse le thème posé
 * avant le premier rendu — un clignotement blanc sur une page sombre — que
 * personne ne rattacherait jamais à une politique de sécurité.
 */
describe('la politique de sécurité du contenu', () => {
  const AVEC_SCRIPT = '<!doctype html><script>document.title = "x"</script><div></div>'

  it('prend l’empreinte du script en ligne, et c’est la vraie', () => {
    /* On recalcule ici avec l'outil du système plutôt que de recopier une
       constante : une empreinte gravée à la main dans un test se périme au
       premier caractère changé, et ce test-là ne garderait plus rien. */
    const attendue = createHash('sha256').update('document.title = "x"', 'utf8').digest('base64')
    expect(empreintesDesScriptsEnLigne(AVEC_SCRIPT)).toEqual([`'sha256-${attendue}'`])
  })

  it('IGNORE un script qui porte `src` — il n’est pas en ligne', () => {
    /* Prendre l'empreinte d'un `<script src>` donnerait celle de son corps
       VIDE, et l'autoriserait donc à exécuter... rien. Sans effet, mais la
       politique porterait une empreinte qui ne désigne aucun code. */
    expect(empreintesDesScriptsEnLigne('<script src="/assets/x.js"></script>')).toEqual([])
    expect(
      empreintesDesScriptsEnLigne('<script type="module" crossorigin src="/a.js"></script>'),
    ).toEqual([])
  })

  it('porte l’empreinte DANS `script-src`, et pas ailleurs', () => {
    const politique = politiqueDeSecurite(AVEC_SCRIPT)
    const scriptSrc = politique.split('; ').find((d) => d.startsWith('script-src '))
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).toContain('sha256-')
    expect(politique).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('ferme ce qui doit être fermé', () => {
    /* Les quatre directives dont l'absence est un défaut à elle seule, et non
       une permissivité de plus : un greffon, une `<base>` injectée, un
       formulaire qui poste ailleurs, un cadre qui détourne un clic
       d'encaissement. */
    const politique = politiqueDeSecurite(AVEC_SCRIPT)
    expect(politique).toContain("object-src 'none'")
    expect(politique).toContain("base-uri 'self'")
    expect(politique).toContain("form-action 'self'")
    expect(politique).toContain("frame-ancestors 'none'")
  })

  it('n’ouvre `connect-src` qu’à sa propre origine', () => {
    /* La directive qui compte le plus si un script hostile entrait quand même :
       c'est elle qui l'empêcherait d'emporter quoi que ce soit ailleurs. */
    expect(politiqueDeSecurite(AVEC_SCRIPT)).toContain("connect-src 'self'")
  })

  it('déclare la fonderie, faute de quoi la page perd sa police', () => {
    /* Mesuré : sans `https://fonts.googleapis.com` dans `style-src`, les douze
       écrans de la porte au navigateur rougissent tous à la fois. */
    const politique = politiqueDeSecurite(AVEC_SCRIPT)
    expect(politique).toContain('style-src')
    expect(politique).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/)
    expect(politique).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/)
  })

  it('rend une politique même sans script en ligne', () => {
    /* Garde du garde : si l'analyse échouait silencieusement, `script-src` se
       réduirait à `'self'` — une politique qui a l'air juste et qui casserait
       le thème. On garde donc que le document SANS script rend bien une
       politique sans empreinte, pour que le cas d'à côté ait un sens. */
    const politique = politiqueDeSecurite('<!doctype html><div></div>')
    expect(politique).toContain("script-src 'self'")
    expect(politique).not.toContain('sha256-')
  })
})


/**
 * ET ELLE EST BEL ET BIEN POSÉE — la garde du garde.
 *
 * Une politique juste que personne n'envoie ne protège de rien, et rien dans le
 * dépôt ne le dirait : `politiqueDeSecurite()` resterait vert, et l'en-tête
 * absent ne casserait aucun écran. `scripts/politique-de-securite.mjs` refuse
 * aussi dans ce cas, mais il coûte un Chromium et un client construit ; celui-ci
 * coûte cent millisecondes et tourne à chaque poussée.
 */
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}
/* Voir `test/environnementRendu.ts` : la photographie se prend par CAS, et non
   au chargement du fichier, sans quoi elle capture l'état laissé par celui qui
   précède — les fichiers de cette suite tournent dans le même processus. */
rendreLEnvironnementIntact()

describe('la politique servie', () => {
  it('tient quand le client MANQUE, et se resserre au lieu de se relâcher', async () => {
    /*
      DÉFAUT PAYÉ DANS CE LOT MÊME. La première rédaction lisait `index.html`
      sans filet, et le serveur cessait de démarrer quand le client manquait —
      `sante.test.ts` l'a dit, avec un `ENOENT` au montage. En production, cela
      change un état dégradé mais diagnosticable en redémarrages en boucle, où
      le contrôle de santé ne répond plus du tout.

      Ce cas garde les DEUX moitiés : le serveur monte, et la politique qu'il
      pose est plus SÉVÈRE — sans document, aucune empreinte à connaître, donc
      aucune à autoriser. On ne relâche jamais la sécurité pour un fichier
      manquant.
    */
    const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-csp-vide-'))
    try {
      vi.resetModules()
      process.env.NODE_ENV = 'production'
      process.env.CLIENT_DIST = dir
      process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
      process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
      const { createApp } = await import('./app.js')
      const reponse = await request(createApp()).get('/api/adresse-inconnue')

      const entete = reponse.headers['content-security-policy']
      expect(entete, 'le client manque et la politique a disparu avec lui').toBeDefined()
      expect(entete, 'une empreinte est autorisée alors qu’aucun document ne la porte').not.toContain(
        'sha256-',
      )
      expect(entete).toContain("script-src 'self'")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('accompagne le document, avec l’empreinte de SON script en ligne', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gestlocpro-csp-'))
    try {
      writeFileSync(
        join(dir, 'index.html'),
        '<!doctype html><title>t</title><script>window.theme = 1</script>',
      )
      vi.resetModules()
      process.env.NODE_ENV = 'production'
      process.env.CLIENT_DIST = dir
      process.env.SESSION_SECRET = 'un-secret-de-test-assez-long-pour-passer'
      process.env.STOCKAGE_RACINE = '/tmp/gestlocpro-stockage-de-test'
      const { createApp } = await import('./app.js')
      const reponse = await request(createApp()).get('/')

      const entete = reponse.headers['content-security-policy']
      expect(entete, 'aucune politique n’accompagne le document').toBeDefined()
      /* L'empreinte doit être celle du script de CE document, et non d'un
         autre : c'est tout l'intérêt de la calculer sur ce qu'on sert. */
      expect(entete).toContain(
        createHash('sha256').update('window.theme = 1', 'utf8').digest('base64'),
      )
      expect(reponse.headers['x-content-type-options']).toBe('nosniff')
      expect(reponse.headers['referrer-policy']).toBe('same-origin')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
