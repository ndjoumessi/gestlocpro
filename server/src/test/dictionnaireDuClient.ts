import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * LE DICTIONNAIRE DU CLIENT, LU COMME UN TEXTE PAR LES CAS DU SERVEUR.
 *
 * ═══ POURQUOI CE MODULE EXISTE ═══
 *
 * Quatre cas d'ici lisent `src/i18n/fr.ts` : le serveur ÉCRIT des clés que le
 * client AFFICHE — un genre d'avis, une valeur d'énumération, une variable
 * interpolée dans un message — et ces cas vérifient que ce qu'il écrit a bien un
 * libellé en face. C'est la seule chose qui empêche une clé brute d'arriver à
 * l'écran d'un utilisateur.
 *
 * Depuis la scission du 2026-10-09, ce dictionnaire vit dans DEUX fichiers :
 * `fr.ts` (ce qui part avec la page d'accueil) et `fr-app.ts` (les mots des
 * écrans, chargés avec eux). La frontière est une décision de CHARGEMENT ; pour
 * qui veut savoir ce que le produit sait dire, le dictionnaire est un seul
 * objet — et toutes les clés que le serveur écrit sont du côté `app`.
 *
 * CE QUE ÇA A COÛTÉ, et c'est la raison d'être de ce fichier : la scission est
 * passée au vert sur `check:rapide` et `check:navigateur`, et a rougi EN
 * INTÉGRATION CONTINUE sur quatre cas d'ici — « leaseRenewal manque à
 * src/i18n/fr.ts », d'une clé qui est écrite. La règle du dépôt dit de lancer la
 * porte serveur quand `server/` bouge ou que le routeur bouge ; ni l'un ni
 * l'autre n'avait bougé. Ce qui avait bougé, c'est un fichier que le serveur LIT
 * sans que rien ne le compile.
 *
 * ═══ CONCATÉNER SUFFIT ICI, ET PAS AILLEURS ═══
 *
 * Ces quatre cas cherchent un MOTIF dans la source — « msg: { », « leaseRenewal:
 * { » — puis découpent à partir de lui. Ils ne reconstruisent aucun chemin de
 * clé, donc l'ordre et l'imbrication des deux moitiés leur sont indifférents.
 *
 * `scripts/dictionnaire-francais.mjs`, lui, expose EN PLUS une version aplatie,
 * parce que ses appelants demandent des clés par chemin pointé et que la machine
 * à pile qui les construit ne revient pas à zéro en fin de fichier. Le piège est
 * décrit là-bas ; il ne touche pas les cas d'ici.
 */
const RACINE = new URL('../../../', import.meta.url).pathname

/**
 * Les sources du dictionnaire d'une langue, bout à bout.
 *
 * @param langue `'fr'` — les deux moitiés — ou `'en'`, qui n'est pas scindé.
 */
export function sourceDuDictionnaire(langue: 'fr' | 'en', racine = RACINE): string {
  const fichiers =
    langue === 'fr' ? ['src/i18n/fr.ts', 'src/i18n/fr-app.ts'] : ['src/i18n/en.ts']
  return fichiers.map((f) => readFileSync(join(racine, f), 'utf8')).join('\n')
}
