/**
 * CE QUE LE CLAVIER COUVRE, LU DANS SON REGISTRE — PLUS RECOPIÉ.
 *
 * ═══ POURQUOI CETTE LECTURE VIT DANS SON PROPRE FICHIER ═══
 *
 * Elle mesure autre chose que `modales.mjs`. Celui-ci ouvre des boîtes et
 * regarde leur géométrie ; celle-ci ne lance aucun navigateur — elle LIT un
 * fichier de cas et compare deux registres. Deux natures de mesure dans un
 * même fichier, c'est un fichier qu'on relit en se demandant lequel des deux
 * on est en train de modifier.
 *
 * Sortie le 2026-10-01, quand `modales.mjs` est repassé sous son plafond de
 * lisibilité. Le rapport, lui, est RESTÉ là-bas : c'est lui qui assemble les
 * deux mesures en une phrase, et le séparer de ses propres compteurs aurait
 * échangé un fichier trop long contre deux fichiers qui se renvoient la balle.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'

/*
  ═══ CE QUE LA RECOPIE A COÛTÉ, DEUX FOIS ═══

  LA PREMIÈRE FOIS, LE RAPPORT LUI-MÊME. La ligne de succès de `modales`
  annonçait « TariffsModal et ParkSettingsModal ne sont pas couvertes par les cas
  clavier » et « sur QUATRE modales » — deux phrases écrites en dur, vraies le
  jour où on les a tapées et fausses dès que les deux modales ont rejoint les cas
  clavier, qui étaient six. Une porte dont le rapport se périme apprend à ne plus
  lire son rapport.

  LA SECONDE FOIS, LE REMÈDE. La rédaction suivante en a tiré la mauvaise leçon :
  elle écrivait `const COUVERTES_AU_CLAVIER = 17` à la main, en défendant le
  choix — « dérivé de l'autre fichier il ne dirait rien, recopié sans compte il
  se périmerait encore ». Le registre du clavier est passé à VINGT le 2026-09-05.
  Ce nombre et la liste recopiée juste au-dessus sont restés à dix-sept,
  D'ACCORD ENTRE EUX puisque tous deux écrits au même endroit, et la porte a
  imprimé « sur 17 modales ; TOUTES y sont » trois jours durant. Trois modales
  n'y étaient pas.

  UNE GARDE QUI AFFIRME EST PIRE QU'UNE GARDE ABSENTE : elle achète une confiance
  qu'elle ne mérite pas, et son rapport se lit comme un fait.

  ═══ LE LIEN SE FAIT PAR LE FICHIER, PAS PAR LE LIBELLÉ ═══

  Les deux registres ne s'adressent pas pareil : dans `modales` le bouton porte
  sa cible — « Corriger l'immeuble Résidence Bonamoussadi » —, dans les cas
  clavier un nom court. Le FICHIER qui rend la modale, lui, est le même des deux
  côtés, et c'est le seul point d'accroche qui ne dépende d'aucune rédaction.

  Le fichier est LU COMME UN TEXTE : ce module tourne sous Node, l'autre est un
  cas sous jsdom, et les relier par import ferait dépendre une porte du
  chargement de l'autre. C'est l'idiome déjà employé par `decisions-nommees` sur
  `Decisions.tsx` et par `notes-conditionnelles` sur les sources.
*/
const REGISTRE_CLAVIER = 'src/features/dashboard/clavierDesModales.test.tsx'
/**
 * BORNÉ AU TABLEAU `MODALES`, ET LA PREMIÈRE RÉDACTION NE L'ÉTAIT PAS.
 *
 * Ce fichier porte aussi `HORS_CLAVIER` — les modales DÉCLARÉES non jouées, avec
 * leur motif — dont les entrées ont le même champ `fichier`. Une lecture qui
 * balaie tout le fichier compte donc les DISPENSES comme des couvertures : elle
 * rendait 23 fichiers pour 19 réellement joués, et déclarait « TOUTES y sont »
 * en s'appuyant sur la liste de celles qui n'y sont pas.
 *
 * C'est exactement le défaut que le commentaire du dessus reproche à la
 * rédaction précédente, reproduit dans son remède au premier essai. Le tableau
 * se délimite donc, et la garde de lisibilité qui suit tient le compte plancher.
 */
/**
 * @param {string} RACINE  la racine du dépôt
 * @param {{nom: string, fichier: string}[]} MODALES  le registre des modales
 * @returns {{fichiers: Set<string>, horsClavier: {nom: string, fichier: string}[]}}
 */
export function lireLaCouvertureClavier(RACINE, MODALES) {
  const sourceDuClavier = readFileSync(join(RACINE, REGISTRE_CLAVIER), 'utf8')
  const debutDuTableau = sourceDuClavier.indexOf('const MODALES: Modale[] = [')
  const finDuTableau = sourceDuClavier.indexOf('\n]', debutDuTableau)
  const fichiersAuClavier = new Set(
    [
      ...sourceDuClavier.slice(debutDuTableau, finDuTableau).matchAll(/fichier: '([^']+)'/g),
    ].map((m) => m[1]),
  )
  if (debutDuTableau === -1 || finDuTableau === -1 || fichiersAuClavier.size < 15) {
    console.error(
      `\n✗ modales : le registre du clavier est illisible — ${fichiersAuClavier.size} fichier(s) trouvé(s).\n` +
        `   Un champ renommé rendrait « aucune couverture » là où il y en a vingt.\n`,
    )
    exit(1)
  }
  const horsClavier = MODALES.filter((m) => !fichiersAuClavier.has(m.fichier))
  return { fichiers: fichiersAuClavier, horsClavier }
}
