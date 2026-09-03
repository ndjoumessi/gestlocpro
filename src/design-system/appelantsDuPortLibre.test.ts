import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * L'EN-TÊTE DE `port-libre.mjs` NOMME SES APPELANTS. IL DOIT DIRE VRAI.
 *
 * ═══ POURQUOI CETTE PROSE-LÀ MÉRITE UNE GARDE ═══
 *
 * Ce module refuse de mesurer un serveur qu'une porte n'a pas lancé. Son
 * en-tête liste les onze scripts qui l'appellent — et cette liste a DÉJÀ menti
 * une fois : sa première rédaction annonçait « sept scripts portent ce contrôle
 * en copie » alors qu'il y en avait dix. Un chiffre écrit de mémoire, dans un
 * commentaire qui prétend documenter un état.
 *
 * Le lot qui a converti les dix copies a réécrit cet en-tête. Il est juste
 * aujourd'hui — mesuré, onze appelants, onze cités. Rien ne le maintiendra :
 * un douzième script qui appellerait le module sans s'y inscrire ne ferait
 * rougir personne, et l'en-tête recommencerait à mentir en silence.
 *
 * ═══ COMMENT ON SÉPARE UN APPELANT D'UNE TOURNURE ═══
 *
 * L'en-tête emploie les accents graves pour tout : `fetch`, `catch`, `npx`,
 * `EADDRINUSE`. Un jeton n'est tenu pour un appelant QUE si `scripts/<jeton>.mjs`
 * existe. Le bruit se sépare ainsi tout seul, sans liste d'exclusion à tenir —
 * et le jour où un script porterait le nom d'un mot-clé, la garde le compterait,
 * ce qui est le bon sens de l'erreur.
 *
 * ═══ LES DEUX SENS, COMME TOUJOURS DANS CE DÉPÔT ═══
 *
 * Un appelant non cité, et une citation qui n'appelle plus. La seconde compte
 * autant : elle décrirait un état disparu, avec l'autorité d'un commentaire.
 */
const RACINE = join(import.meta.dirname, '../..')
const MODULE = join(RACINE, 'scripts/port-libre.mjs')

/** Les scripts qui importent réellement le module. */
function appelantsReels(): string[] {
  return readdirSync(join(RACINE, 'scripts'))
    .filter((nom) => nom.endsWith('.mjs') && nom !== 'port-libre.mjs')
    .filter((nom) =>
      readFileSync(join(RACINE, 'scripts', nom), 'utf8').includes("from './port-libre.mjs'"),
    )
    .map((nom) => nom.replace(/\.mjs$/, ''))
    .sort()
}

/**
 * Les scripts NOMMÉS dans l'en-tête.
 *
 * On ne lit que le premier commentaire de bloc : la liste y vit, et le reste du
 * fichier cite des noms pour d'autres raisons — un exemple, une comparaison.
 */
function appelantsCites(): string[] {
  const source = readFileSync(MODULE, 'utf8')
  const entete = source.slice(0, source.indexOf('*/') + 2)
  const jetons = [...entete.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]!)
  return [...new Set(jetons)]
    .filter((jeton) => existsSync(join(RACINE, 'scripts', `${jeton}.mjs`)))
    .sort()
}

describe('l’en-tête de `port-libre.mjs`', () => {
  it('trouve bien des appelants — sans quoi cette garde ne garderait rien', () => {
    /* Un renommage du module rendrait DEUX listes vides, et les deux cas
       suivants passeraient au vert en ne comparant rien. */
    expect(appelantsReels().length).toBeGreaterThanOrEqual(10)
    expect(appelantsCites().length).toBeGreaterThanOrEqual(10)
  })

  it('nomme TOUS les scripts qui appellent le module', () => {
    const cites = new Set(appelantsCites())
    const absents = appelantsReels().filter((nom) => !cites.has(nom))
    expect(
      absents,
      'ces portes appellent `port-libre.mjs` sans figurer dans son en-tête, qui ' +
        'prétend pourtant les lister :\n  ' + absents.join('\n  '),
    ).toEqual([])
  })

  it('ne nomme AUCUN script qui ne l’appelle plus', () => {
    const reels = new Set(appelantsReels())
    const fantomes = appelantsCites().filter((nom) => !reels.has(nom))
    expect(
      fantomes,
      'l’en-tête décrit un état disparu, avec l’autorité d’un commentaire :\n  ' +
        fantomes.join('\n  '),
    ).toEqual([])
  })
})
