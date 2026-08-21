import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde des modales : un formulaire, et une seule action primaire.
 *
 * UNE CONTRAINTE STRUCTURELLE UNIQUE produisait deux défauts opposés. `Modal`
 * rend son corps et son pied dans deux `<div>` FRÈRES : un `<form>` autour du
 * corps ne peut donc pas contenir le bouton du pied. Les modales du parc ont
 * tranché différemment, aucune n'avait les deux, et aucune ne le commentait.
 *
 * Deux d'entre elles n'avaient PAS DE FORMULAIRE DU TOUT : Entrée n'y validait
 * rien. Le coût n'est pas seulement au clavier — sur un clavier virtuel de
 * téléphone, un champ hors formulaire perd sa touche d'action « Aller », donc
 * le clavier reste ouvert par-dessus la barre d'actions au moment précis où il
 * faut l'atteindre.
 *
 * Une troisième avait l'inverse : son bouton « Fermer » était PRIMAIRE — c'est
 * le défaut de `Button` — en encre pleine, dans la barre épinglée qui ne défile
 * jamais, pendant que le vrai geste vivait dans le corps défilant. Le bouton le
 * plus fort de l'écran était celui qui abandonne.
 *
 * Le remède des deux est le même : l'attribut `form`, fait pour qu'un bouton
 * soumette un formulaire qui ne le contient pas.
 *
 * Ce contrôle lit les SOURCES, comme ses voisines et pour la même raison : ni
 * la structure du DOM ni la variante d'un bouton ne se mesurent dans jsdom sans
 * monter chaque modale du produit une à une, ce que personne n'a fait.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/** Une modale : un composant dont le fichier porte ce nom. */
const EST_UNE_MODALE = /Modal\.tsx$/

/**
 * Les fichiers examinés : les modales du produit, jamais la primitive.
 *
 * `Modal.tsx` est le composant qui pose la contrainte, il ne la subit pas.
 */
function modales(depuis: string): string[] {
  return readdirSync(depuis).flatMap((entree: string) => {
    const chemin = join(depuis, entree)
    if (statSync(chemin).isDirectory()) return modales(chemin)
    if (!EST_UNE_MODALE.test(entree)) return []
    if (entree === 'Modal.tsx') return []
    return [chemin]
  })
}

/** Commentaires retirés : ce contrôle nomme des fichiers, jamais des lignes. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, avant: string) => avant)
}

const CHAMPS = /<Field\b/g
const FORMULAIRE = /<form\b/
/**
 * Un bouton sans `variant=` : donc primaire, c'est le défaut de `Button`.
 *
 * LA RÈGLE « UNE SEULE ACTION PRIMAIRE » A ÉTÉ ÉCRITE PUIS RETIRÉE, et le motif
 * survit pour que la source témoin puisse dire pourquoi. Trois modales du parc
 * portent deux boutons primaires DANS DES BRANCHES MUTUELLEMENT EXCLUSIVES —
 * le panneau d'issue OU le formulaire, jamais les deux à l'écran. Une lecture de
 * source ne sait pas les départager, et une garde qui accuse du code correct
 * finit désactivée, ce qui coûte plus cher que le défaut qu'elle cherchait.
 *
 * Le défaut réel — un « Fermer » primaire dans une barre épinglée pendant que le
 * vrai geste défile hors champ — est corrigé et commenté à son site. Il attend
 * une garde qui sache lire les branches ; ce n'est pas celle-ci.
 */
const BOUTON_PRIMAIRE = /<Button(?![A-Za-z])(?:(?!\/?>)[\s\S])*?>/g

function compteChamps(source: string): number {
  return [...source.matchAll(CHAMPS)].length
}

/**
 * LA RÈGLE, écrite UNE fois et partagée par le contrôle et son témoin.
 *
 * La première rédaction la réécrivait dans le témoin. Une mutation l'a montré :
 * porter le seuil hors d'atteinte vidait le contrôle sans que rien ne rougisse,
 * puisque le témoin, lui, gardait l'ancien seuil en dur. Un témoin qui
 * paraphrase la règle ne garde que sa paraphrase.
 *
 * Deux champs et non un : une modale à champ unique se valide au clavier sans
 * cérémonie, et l'exiger d'elle ferait rougir du code sain.
 */
function manqueUnFormulaire(source: string): boolean {
  return compteChamps(source) >= 2 && !FORMULAIRE.test(source)
}

function boutonsPrimaires(source: string): number {
  return [...source.matchAll(BOUTON_PRIMAIRE)].filter((m) => !/\bvariant=/.test(m[0])).length
}

describe('les modales du produit', () => {
  it('portent un formulaire dès qu’elles portent des champs', () => {
    const sansFormulaire = modales(SRC)
      .map((chemin) => ({ chemin, source: sansCommentaires(readFileSync(chemin, 'utf8')) }))
      .filter(({ source }) => manqueUnFormulaire(source))
      .map(({ chemin }) => chemin.slice(SRC.length + 1))

    expect(sansFormulaire).toEqual([])
  })

  /**
   * LE CAS POSITIF, sans lequel les deux précédents ne gardent rien.
   *
   * Deux contrôles qui n'affirment qu'une absence ne distinguent pas un dépôt
   * sain d'un détecteur cassé — ce dépôt l'a payé trois fois cette semaine. La
   * source témoin porte les quatre formes, et la règle doit trancher les quatre.
   */
  it('reconnaît les deux défauts, et eux seuls', () => {
    const deuxChamps = '<Field /><Field />'

    // Deux champs, aucun formulaire : c'est le défaut.
    expect(manqueUnFormulaire(deuxChamps)).toBe(true)
    // Les mêmes champs dans un formulaire : rien à signaler.
    expect(manqueUnFormulaire(`<form>${deuxChamps}</form>`)).toBe(false)
    // Un seul champ hors formulaire ne fait pas un formulaire manquant : une
    // modale à un champ se valide au clavier sans cérémonie.
    expect(manqueUnFormulaire('<Field />')).toBe(false)

    // Deux boutons sans variante : c'est le second défaut.
    expect(boutonsPrimaires('<Button>a</Button><Button>b</Button>')).toBe(2)
    // Un primaire et un secondaire : la forme attendue d'un pied de modale.
    expect(boutonsPrimaires('<Button variant="secondary">a</Button><Button>b</Button>')).toBe(1)
    // `ButtonLien` n'est pas `Button` : le motif ne doit pas déborder sur lui.
    expect(boutonsPrimaires('<ButtonLien>a</ButtonLien>')).toBe(0)
  })
})
