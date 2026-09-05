import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * TOUT SCRIPT QUI SERT `dist/` REFUSE D'ABORD UN PAQUET PÉRIMÉ.
 *
 * ═══ CE QUE ÇA A COÛTÉ, TROIS FOIS EN UNE JOURNÉE ═══
 *
 * Les gardes de navigateur ne lisent pas les sources : elles ouvrent un
 * navigateur sur `dist/`, servi par `vite preview`. Une seule les fait
 * construire — `mesure-ui`, première de la chaîne. Les treize autres mesurent
 * ce qui traîne sur le disque.
 *
 * Lancer un script SEUL après une modification mesure donc le code d'AVANT, en
 * silence. Le 2026-09-05 :
 *
 *   1. `npm run modales` a rendu « 11 px de défilement, plafond 11 » — VERT —
 *      sur une modale qui en demandait 82. La chaîne complète, qui construit,
 *      l'a refusée dix minutes plus tard.
 *   2. J'ai failli inscrire 11 comme plafond mesuré. Un faux plafond ne rougit
 *      pas : il garde un écran qui n'existe plus.
 *   3. `notes-conditionnelles` a échoué sur un clic en délai d'attente — le
 *      bouton n'était pas dans le paquet. J'ai d'abord cherché le défaut dans
 *      la garde.
 *
 * C'EST UN FAUX VERT, ET C'EST PIRE QU'UN FAUX ROUGE. Un rouge se lit et
 * s'enquête ; un vert se croit.
 *
 * ═══ CE QUE CETTE GARDE VÉRIFIE ═══
 *
 * Que chaque script servant `dist/` appelle `exigerUnPaquetAJour` — lequel
 * compare la source la plus récente au paquet et REFUSE quand la source est plus
 * jeune.
 *
 * ═══ ELLE EST DÉRIVÉE, ET C'EST DÉLIBÉRÉ ═══
 *
 * La liste des scripts concernés se LIT dans `scripts/`, elle ne s'écrit pas à
 * la main : un registre manuel accueillerait le prochain oubli sans un mot,
 * comme les deux registres de modales de ce dépôt le font encore. Le critère
 * est mécanique — un script qui lance `vite preview` ou qui pose `CLIENT_DIST`
 * sert le paquet — et le prochain script qui le fera sans la garde fera rougir
 * ce cas le jour où il est écrit.
 *
 * `mesure-ui` en est DISPENSÉ, et lui seul : il construit le paquet lui-même,
 * juste avant de le servir. Lui demander de vérifier la fraîcheur de ce qu'il
 * vient d'écrire serait une garde qui se mesure elle-même.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** Il construit ce qu'il sert : la fraîcheur est acquise, pas à vérifier. */
const CONSTRUIT_LUI_MEME = ['mesure-ui.mjs']

/** Un script sert le paquet s'il lance `vite preview` ou s'il pose `CLIENT_DIST`. */
function sertLePaquet(code: string): boolean {
  return /'preview'/.test(code) || /CLIENT_DIST/.test(code)
}

function scriptsQuiServentLePaquet(): string[] {
  return readdirSync(join(RACINE, 'scripts'))
    .filter((nom) => nom.endsWith('.mjs'))
    .filter((nom) => sertLePaquet(readFileSync(join(RACINE, 'scripts', nom), 'utf8')))
    .sort()
}

describe('un script qui sert le paquet', () => {
  it('est bien TROUVÉ — sans quoi cette garde ne garderait rien', () => {
    /* Un motif rompu rendrait une liste vide, et « aucun oubli » se lirait comme
       « rien à couvrir ». Onze au jour de l'écriture. */
    expect(scriptsQuiServentLePaquet().length).toBeGreaterThanOrEqual(10)
  })

  it('refuse d’abord un paquet PÉRIMÉ', () => {
    const sansGarde = scriptsQuiServentLePaquet()
      .filter((nom) => !CONSTRUIT_LUI_MEME.includes(nom))
      .filter(
        (nom) =>
          !readFileSync(join(RACINE, 'scripts', nom), 'utf8').includes('exigerUnPaquetAJour'),
      )

    expect(
      sansGarde,
      'ces scripts mesureraient le code d’AVANT sans le dire — un faux VERT, qui se ' +
        'croit là où un rouge s’enquête. Appelez `exigerUnPaquetAJour()` avant de ' +
        `servir :\n  ${sansGarde.join('\n  ')}`,
    ).toEqual([])
  })

  it('ne dispense QUE celui qui construit', () => {
    /* Une dispense qui ne décrit plus rien vaut une garde absente, avec
       l'autorité d'un registre. */
    const mortes = CONSTRUIT_LUI_MEME.filter((nom) => {
      const code = readFileSync(join(RACINE, 'scripts', nom), 'utf8')
      return !sertLePaquet(code) || !/'build'/.test(code)
    })
    expect(
      mortes,
      `ces dispenses ne décrivent plus un script qui construit :\n  ${mortes.join('\n  ')}`,
    ).toEqual([])
  })
})
