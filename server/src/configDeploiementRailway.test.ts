import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * CE QUI FAIT SE CONSTRUIRE CE DÉPÔT — ET CE QUI N'EST PLUS ICI.
 *
 * ═══ POURQUOI `railway.json` A DISPARU ═══
 *
 * Il déclarait `builder: DOCKERFILE`, `dockerfilePath`, un `healthcheckPath` et
 * une politique de redémarrage. Trois raisons l'ont retiré, dans cet ordre :
 *
 *   1. Il était à la RACINE, donc partagé par les DEUX services qui
 *      construisent ce dépôt — le web et la tâche planifiée `relances`. Un
 *      réglage écrit là s'appliquait aux deux sans qu'aucun le demande.
 *   2. Config as Code est déprécié : ces fichiers cessent d'être lus le
 *      2026-12-01. Ce qui n'y survit pas doit vivre ailleurs AVANT.
 *   3. Son `builder` était REDONDANT. Railway détecte un `Dockerfile` à la
 *      racine et l'emploie de lui-même — c'est ce que fait déjà `relances`,
 *      dont le tableau de bord dit `RAILPACK` et qui bâtit pourtant ce dépôt.
 *
 * ═══ CE QUE CE FICHIER NE PEUT PAS MESURER, ET QUI L'ASSUME ═══
 *
 * `healthcheckPath` et la politique de redémarrage vivent désormais dans les
 * réglages du service, chez l'hébergeur. AUCUNE PORTE D'ICI NE LES VOIT. C'est
 * un recul assumé et non un oubli : le DSL qui les remplacerait en dépôt
 * (`.railway/railway.ts`) ne sait pas exprimer le constructeur — le migrateur
 * de Railway le rend en COMMENTAIRE — et migrer aujourd'hui coûterait plus que
 * ça ne rapporte.
 *
 * À re-regarder quand ce DSL saura le dire. Le dernier cas tient la date.
 */
const RACINE = join(import.meta.dirname, '..', '..')
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

describe('ce qui construit ce dépôt', () => {
  it('garde un Dockerfile à la racine : Railway ne détecte que là', () => {
    /* Le déplacer ou le renommer ne casserait RIEN de visible : la
       construction retomberait silencieusement sur le constructeur par défaut,
       celui-là même que l'en-tête du Dockerfile dit avoir échoué deux fois. */
    expect(existsSync(join(RACINE, 'Dockerfile'))).toBe(true)
  })

  it('embarque les sources du serveur dans l’image', () => {
    /* COUPLAGE NON ÉVIDENT, ET C'EST TOUT SON DANGER. La tâche planifiée ne
       lance pas le serveur bâti : elle exécute du TypeScript par `tsx`, sur un
       chemin de SOURCE. Une image affinée en plusieurs étapes qui ne garderait
       que `dist/` bâtirait un web parfait et une relance qui ne démarre pas —
       à 7 h du matin, sans personne pour le voir. */
    expect(lire('Dockerfile'), 'l’image porte l’arbre entier').toMatch(/^COPY \. \.$/m)
    expect(
      JSON.parse(lire('server/package.json')).scripts['relances:auto'],
      'la relance lit une source, pas un paquet bâti',
    ).toContain('src/')
  })

  it('ne réintroduit aucun railway.json ni railway.toml', () => {
    /* Le remettre ressusciterait les trois défauts d'un coup : un réglage
       partagé par deux services aux besoins opposés, une écriture dépréciée, et
       un `cronSchedule` posé là convertirait le service WEB en tâche
       planifiée — le produit cesserait d'être servi entre deux passages. */
    for (const nom of ['railway.json', 'railway.toml']) {
      expect(existsSync(join(RACINE, nom)), `${nom} ne doit pas revenir`).toBe(false)
    }
  })

  it('re-regarde la migration en dépôt avant le 2026-12-01', () => {
    /* UN MOIS DE MARGE. Rien ne casse à l'échéance — le constructeur est
       détecté, les deux réglages sont chez l'hébergeur. Ce qu'on va vérifier,
       c'est si `.railway/railway.ts` sait enfin exprimer le constructeur, pour
       ramener en dépôt ce qui en est sorti. */
    expect(
      new Date() < new Date('2026-11-01T00:00:00Z'),
      'le DSL de Railway sait-il enfin dire le constructeur ? Si oui, ramener ' +
        'healthcheck et politique de redémarrage dans `.railway/railway.ts`. ' +
        'Sinon, repousser cette date en disant pourquoi.',
    ).toBe(true)
  })
})
