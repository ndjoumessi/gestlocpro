import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UN GROUPE DE CHOIX EST UN GROUPE DE BOUTONS RADIO — DE VRAIS.
 *
 * ═══ CE QUE LA RECOPIE PERD, ET CE N'EST PAS L'APPARENCE ═══
 *
 * `Choice.tsx` expose `RadioCards variant="puces"`, écrit pour ce cas précis :
 * son commentaire cite « Ouvrir un chantier », six métiers et trois urgences.
 * Deux écrans le refont pourtant à la main, sur des `<button role="radio">`
 * avec gestion clavier maison. Ce qu'ils y perdent :
 *
 *   · LA COCHE. La primitive en pose une, avec sa raison écrite : « la sélection
 *     n'est pas portée par la couleur seule … sous deutéranopie, deux teintes de
 *     statut sont à 3,4 de ΔE00 ». Dans les copies, le choix actif ne se
 *     distingue que par son remplissage.
 *   · L'ANNEAU DE FOCUS. La primitive porte `has-[:focus-visible]:outline-2`.
 *     Les copies n'ont aucune règle de focus — et comme les entrées non actives
 *     y sont `tabIndex={-1}`, le seul repère de navigation au clavier restant
 *     est la couleur du fond.
 *   · LE CLAVIER NATIF. Un vrai `input[type=radio]` donne les flèches, l'annonce
 *     « 2 sur 5 », le saut des entrées désactivées et le groupe atteignable à la
 *     tabulation. Chaque copie réécrit une partie de cela, et chacune s'arrête à
 *     un endroit différent. L'une d'elles devenait INATTEIGNABLE à la tabulation
 *     dès que sa première entrée était désactivée : `tabIndex` était posé sur
 *     elle, et les deux autres portaient `-1`.
 *
 * ═══ POURQUOI UNE GARDE DE SOURCE ═══
 *
 * Une recopie de contrôle ne casse rien de visible. Elle passe le rendu, elle
 * passe le contraste, elle passe même une partie du clavier. Ce qu'elle perd se
 * découvre en tabulant sur un écran précis dans un état précis — c'est-à-dire à
 * peu près jamais.
 *
 * `role="radio"` ÉCRIT À LA MAIN est la signature exacte de la recopie : un vrai
 * bouton radio n'a pas besoin qu'on lui déclare son rôle.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/* Assemblé, jamais écrit en clair : la chaîne cherchée doit être exactement
   celle qu'on interdit, et ce fichier ne doit pas être son propre coupable. */
const RADIO_A_LA_MAIN = ['role="', 'radio', '"'].join('')

/** La primitive a le droit de le poser — c'est elle qui le tient. */
const PRIMITIVE = 'Choice.tsx'

function sources(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) sources(chemin, trouves)
    else if (/\.tsx$/.test(entree.name) && !entree.name.includes('.test.')) trouves.push(chemin)
  }
  return trouves
}

/** Les commentaires ont le droit de citer ce qu'ils proscrivent. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('les groupes de choix', () => {
  const fichiers = sources(SRC).filter((f) => !f.endsWith(PRIMITIVE))

  /* GARDE DE LA GARDE — un balayage vide passerait vert sans rien lire. */
  it('sont cherchés dans une source non vide', () => {
    expect(fichiers.length, 'aucun fichier source balayé').toBeGreaterThan(50)
  })

  it('emploient de vrais boutons radio, jamais un rôle posé à la main', () => {
    const fautifs = fichiers
      .filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(RADIO_A_LA_MAIN))
      .map((f) => f.replace(SRC + '/', ''))

    expect(
      fautifs,
      'ces écrans refont `RadioCards` à la main — sans coche, sans anneau de focus, ' +
        'et avec un clavier réécrit à chaque fois',
    ).toEqual([])
  })
})
