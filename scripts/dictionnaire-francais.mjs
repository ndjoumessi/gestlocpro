/**
 * LE DICTIONNAIRE FRANÇAIS ENTIER, pour les scripts qui le lisent COMME UN TEXTE.
 *
 * ═══ POURQUOI CE MODULE EXISTE ═══
 *
 * Depuis la scission du 2026-10-09, le dictionnaire français vit dans DEUX
 * fichiers : `src/i18n/fr.ts` (ce qui part sur le fil avec la page d'accueil) et
 * `src/i18n/fr-app.ts` (les mots des écrans, chargés avec eux). La frontière est
 * une décision de CHARGEMENT, pas une décision de contenu : pour qui veut savoir
 * ce que le produit sait dire, le dictionnaire est un seul objet.
 *
 * Quatre portes le lisaient par `readFile('src/i18n/fr.ts')`. Après la scission,
 * elles ne voyaient plus que le quart impatient — et elles ne se sont pas tues :
 * `decisions-nommees` a rendu SOIXANTE divergences d'un coup, chacune disant
 * « le dictionnaire ne la nomme pas » d'une clé qui existe. C'est le bon
 * comportement, et c'est ce qui a mené ici.
 *
 * ═══ DEUX ENTRÉES, PARCE QUE CONCATÉNER NE SUFFIT PAS ═══
 *
 * `sourceDuFrancais` rend les deux textes bout à bout, pour les portes qui
 * cherchent un motif dans la source.
 *
 * `francaisAPlat` flatte chaque moitié SÉPARÉMENT puis fusionne les cartes — et
 * c'est le geste qui compte. `dictionnaireAPlat` est une machine à pile, et sa
 * pile ne revient PAS à zéro en fin de fichier : mesuré sur le `fr.ts` de `main`,
 * avant toute scission, ses dernières clés s'appellent
 * `marketing.pricing.essential.pro.footer.rights` — un emboîtement qui n'existe
 * nulle part. Le travers est inoffensif sur un fichier unique, puisque les
 * chemins fautifs ne sont jamais demandés. Concaténé, il cesse de l'être : la
 * pile héritée préfixe TOUT `fr-app.ts`, et `app.lease.noticeNone` devient
 * introuvable alors qu'il est écrit.
 *
 * Mesuré en le faisant : 2 197 clés dans les deux cas, et pas une seule `app.*`
 * joignable. Un compte juste pour une carte fausse — exactement le genre de vert
 * qu'on ne remarque pas.
 *
 * CE MODULE NE FAIT RIEN À L'IMPORT — il n'expose qu'une fonction. Ce dépôt a
 * déjà payé l'inverse : importer un script de `scripts/` pour en prendre une
 * fonction l'EXÉCUTE.
 *
 * ═══ ET LE SERVEUR LIT CE DICTIONNAIRE AUSSI ═══
 *
 * Quatre cas de `server/src` le lisent pour vérifier que les clés que le serveur
 * ÉCRIT ont un libellé en face. Ils ont leur propre module —
 * `server/src/test/dictionnaireDuClient.ts` —, parce que `server/` est un autre
 * projet TypeScript et n'importe rien d'ici.
 *
 * LA LEÇON VAUT PLUS QUE LE CORRECTIF. La scission est passée au vert sur
 * `check:rapide` ET `check:navigateur`, et a rougi EN INTÉGRATION CONTINUE sur
 * ces quatre cas — « leaseRenewal manque à src/i18n/fr.ts », d'une clé qui est
 * écrite. La règle du dépôt dit de lancer la porte serveur quand `server/` bouge
 * ou que le routeur bouge ; ni l'un ni l'autre n'avait bougé. Ce qui avait bougé
 * était un fichier du CLIENT que le serveur lit sans que rien ne le compile.
 *
 * La règle qui tient vraiment : `npm run check:server` dès qu'on touche à
 * `src/i18n/`, quoi qu'il arrive au reste.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dictionnaireAPlat } from './check-i18n.mjs'

/**
 * Le texte des deux moitiés, bout à bout.
 *
 * @param {string} racine Racine du dépôt.
 * @returns {string} Les sources concaténées, dans l'ordre fr puis fr-app.
 */
export function sourceDuFrancais(racine) {
  return [
    readFileSync(join(racine, 'src/i18n/fr.ts'), 'utf8'),
    readFileSync(join(racine, 'src/i18n/fr-app.ts'), 'utf8'),
  ].join('\n')
}

/**
 * Les deux moitiés APLATIES et fusionnées — voir l'en-tête pour pourquoi ce
 * n'est pas `dictionnaireAPlat(sourceDuFrancais(…))`.
 *
 * @param {string} racine Racine du dépôt.
 * @returns {Map<string, string>} Chemin pointé → texte.
 */
export function francaisAPlat(racine) {
  const carte = new Map()
  for (const fichier of ['src/i18n/fr.ts', 'src/i18n/fr-app.ts'])
    for (const [cle, valeur] of dictionnaireAPlat(readFileSync(join(racine, fichier), 'utf8')))
      carte.set(cle, valeur)
  return carte
}
