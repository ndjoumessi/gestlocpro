/**
 * LE SERVEUR DE PRÉVISUALISATION, LANCÉ UNE FOIS POUR TOUTES LES PORTES.
 *
 * Dix portes au navigateur servaient `dist/` par `vite preview`, et chacune
 * portait sa propre copie du geste : contrôle de pré-vol, `spawn`, deux
 * signaux, boucle d'attente. Mesuré le 2026-09-10 — vingt-deux lignes de code
 * identiques à trois mots près, dix fois.
 *
 * ═══ ET LES COPIES AVAIENT DÉJÀ DIVERGÉ ═══
 *
 * Sans que personne ne l'ait décidé, l'attente maximale valait :
 *
 *     80 essais (20 s)   couleur-non-seule, poids-ecrans
 *    100 essais (25 s)   sept portes
 *     60 essais (15 s)   mesure-ui, avec une boucle réécrite
 *
 * C'est la dérive silencieuse que ce dépôt redoute, prise sur le fait : trois
 * budgets pour un même geste, aucun mesuré, aucun défendu. L'attente est
 * désormais UNE, à 100 essais de 250 ms — le plus long des trois. Elle ne coûte
 * rien quand le serveur répond, ce qu'il fait en deux secondes ; la raccourcir
 * n'achèterait que des faux rouges sur une machine chargée.
 *
 * ═══ CE QUE CHAQUE MORCEAU GARDE, ET IL A ÉTÉ PAYÉ ═══
 *
 * LE PRÉ-VOL. `exigerUnPortLibre` d'abord : si quelque chose répond déjà, on
 * refuse. Relevé le 2026-09-01 : quatre prévisualisations orphelines tournaient,
 * 4183, 4188, 4193 et 4199, la plus ancienne depuis deux jours et dix-huit
 * heures. Elles survivent à toute porte interrompue avant son `kill`. Le dégât
 * reste théorique tant que l'orphelin sert le MÊME `dist/` ; il cesse de l'être
 * dès qu'il vient d'un autre dossier de travail, et la porte rend alors un vert
 * sur un paquet que personne n'a construit.
 *
 * `--strictPort`. Sans lui, `vite preview` trouve le port occupé et se déplace
 * SANS BRUIT sur le suivant, pendant que la porte interroge celui qu'elle a
 * demandé — donc l'intrus. Une porte qui ne peut pas s'exécuter doit le DIRE.
 *
 * LES DEUX SIGNAUX. Un Ctrl-C tue le script et laisse le serveur : c'est ainsi
 * que naissent les orphelins ci-dessus. Ces deux lignes emportent le fils avec
 * la porte ; le pré-vol reste pour les morts qu'aucun signal n'annonce.
 *
 * SURVEILLER LA MORT DU FILS NE REMPLACERAIT NI L'UN NI L'AUTRE : `npx` est le
 * fils, Vite le petit-fils, et la réponse d'un intrus arrive avant que la mort
 * ne remonte. Le seul contrôle qui ne court pas est celui qui PRÉCÈDE.
 *
 * ═══ QUI N'EST PAS ICI, ET POURQUOI ═══
 *
 * `espace-connecte` lance le VRAI serveur — `app.ts` en production, avec sa base
 * et ses en-têtes — et non `vite preview`, qui n'en pose aucun. Son lancement
 * n'a donc rien à partager ; son ATTENTE, si, et elle emploie la même.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { exigerUnPortLibre } from './port-libre.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/*
  CENT ESSAIS DE 250 ms — vingt-cinq secondes.

  Écrit ici, une fois, plutôt que trois fois à trois valeurs. Le chiffre est le
  plus long des trois qui coexistaient : on ne raccourcit pas une attente sans
  l'avoir mesurée, et personne ne l'avait fait.
*/
const ESSAIS = 100
const PAS_MS = 250

/**
 * Attend qu'une adresse réponde 200, et rend `true` si elle l'a fait.
 *
 * Séparée du lancement pour que `espace-connecte`, qui monte un autre serveur,
 * emploie la même attente sans hériter du `spawn` de `vite preview`.
 */
export async function attendreUneReponse(base, essais = ESSAIS) {
  for (let i = 0; i < essais; i++) {
    try {
      if ((await fetch(base + '/')).ok) return true
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((r) => setTimeout(r, PAS_MS))
  }
  return false
}

/**
 * Lance `vite preview` sur `port` et rend le processus fils.
 *
 * @param {string} nom  Le nom de la porte, pour que tout refus se situe.
 * @param {number} port Le port, libre — il est vérifié avant le lancement.
 * @returns {Promise<import('node:child_process').ChildProcess>} le fils, à tuer.
 */
export async function servirLaPrevisualisation(nom, port) {
  /*
    LE PAQUET AVANT LE SERVEUR, ET C'EST ICI QUE ÇA SE DÉCIDE MAINTENANT.

    Ce qui est servi est `dist/`, jamais les sources : un paquet périmé fait
    rendre un verdict sur le code d'AVANT, en silence. Chaque porte portait cet
    appel — et devait y penser. Il vit désormais au point UNIQUE où l'on sert :
    une porte nouvelle l'obtient sans le savoir, et aucune ne peut l'oublier.

    `mesure-ui` construit son propre paquet AVANT d'appeler cette fonction — 
    vérifié, la construction précède le service de cent quarante lignes —, donc
    le contrôle passe pour elle comme pour les autres. Sa dispense d'autrefois
    n'a plus d'objet.
  */
  exigerUnPaquetAJour()

  const base = `http://127.0.0.1:${port}`
  await exigerUnPortLibre(nom, base, port)

  const fils = spawn(
    'npx',
    ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: RACINE, stdio: 'ignore' },
  )

  const emporter = () => {
    fils.kill()
    process.exit(130)
  }
  process.once('SIGINT', emporter)
  process.once('SIGTERM', emporter)

  if (await attendreUneReponse(base)) return fils

  fils.kill()
  throw new Error(
    `${nom} : le serveur de prévisualisation n’a pas répondu sur ${base} ` +
      `après ${(ESSAIS * PAS_MS) / 1000} s.`,
  )
}
