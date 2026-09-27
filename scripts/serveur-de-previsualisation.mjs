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

  /*
    ═══ `detached` — SANS LUI, LE KILL MANQUAIT SA CIBLE ═══

    Ce fichier savait déjà que « `npx` est le fils, Vite le petit-fils » : c'est
    écrit dans son en-tête, à propos de la surveillance de la mort du fils.
    `fils.kill()` visait donc `npx`, et le PETIT-FILS — celui qui ÉCOUTE — lui
    survivait. Les trois chemins de sortie ci-dessous étaient corrects, et les
    trois tuaient le mauvais processus.

    MESURÉ LE 2026-09-27, et deux fois dans la même heure : deux relevés lancés
    de suite sur le MÊME port échouent au pré-vol du second, avec la plainte
    « quelque chose répond déjà sur 4193 ». Le coupable est le petit-fils du
    premier, dont la ligne de commande est bien `node …/vite preview --port 4193`.
    Trois de ces orphelins tenaient 4193, 4197 et 4198 ; aucune interruption au
    clavier n'était en cause, et les portes s'étaient terminées normalement.

    C'est aussi ce que `port-libre.mjs` appelle « un orphelin d'un passage
    interrompu » sans jamais pouvoir dire d'où il vient : la plupart du temps il
    ne vient d'aucune interruption, mais d'un `kill` qui ne portait pas assez
    loin.

    `detached` fait du fils le CHEF de son groupe, et le petit-fils y entre : un
    signal envoyé au groupe — `-pid` — les emporte tous les deux. Sans
    `unref()` : on veut garder la main sur lui, pas le laisser vivre sa vie.
  */
  const fils = spawn(
    'npx',
    ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: RACINE, stdio: 'ignore', detached: true },
  )

  /**
   * Emporte le groupe entier, `npx` et le serveur qu'il a lancé.
   *
   * `SIGKILL` et non `SIGTERM` : on ne négocie pas la libération d'un port avec
   * un processus dont on vient de décider la mort, et un serveur qui s'attarde
   * une seconde de trop fait échouer le pré-vol de la porte suivante — c'est le
   * défaut même que ce bloc corrige. Le `catch` couvre le groupe déjà parti, qui
   * n'est pas une erreur.
   */
  const emporterLeGroupe = () => {
    try {
      process.kill(-fils.pid, 'SIGKILL')
    } catch {
      /* déjà parti, ou jamais né */
    }
  }

  const emporter = () => {
    emporterLeGroupe()
    process.exit(130)
  }
  process.once('SIGINT', emporter)
  process.once('SIGTERM', emporter)

  /*
    LE FILS MEURT AVEC SON PÈRE, QUEL QUE SOIT LE CHEMIN DE SORTIE.

    Les deux signaux ci-dessus couvraient l'interruption au clavier. Ils ne
    couvraient PAS le cas courant : une sonde dont le corps échoue. Node sort
    alors normalement — le rejet d'un `await` de premier niveau suffit —, mais
    personne n'a tué `vite preview`, qui SURVIT à son parent et garde le port.

    REPRODUIT le 2026-09-25 avant d'écrire ce correctif : une sonde qui lève
    juste après avoir obtenu le serveur laisse le port tenu, node ayant déjà
    rendu la main. Deux orphelins de ce genre tenaient 4322 et 4323 depuis douze
    heures ; c'est aussi ce que `port-libre.mjs` appelle « un orphelin d'un
    passage interrompu » dans son message de refus, sans jamais dire d'où il
    vient.

    `exit` attrape TOUS les chemins — fin normale, exception non rattrapée,
    `process.exit()` explicite — et il ne peut rien faire d'asynchrone, ce qui
    tombe bien : `kill` est synchrone. Le `catch` couvre le fils déjà mort, qui
    n'est pas une erreur.
  */
  process.once('exit', emporterLeGroupe)

  if (await attendreUneReponse(base)) {
    /* LE GROUPE EST RENDU AVEC LE FILS : les portes appellent `serveur.kill()`
       à la fin de leur `finally`, et ce `kill`-là manquait la même cible que les
       trois autres. Une seule ligne à changer chez elles serait une ligne à
       oublier ; on remplace donc la méthode sur l'objet qu'elles reçoivent. */
    fils.kill = emporterLeGroupe
    return fils
  }

  emporterLeGroupe()
  throw new Error(
    `${nom} : le serveur de prévisualisation n’a pas répondu sur ${base} ` +
      `après ${(ESSAIS * PAS_MS) / 1000} s.`,
  )
}
