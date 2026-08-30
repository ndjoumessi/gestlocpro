import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UNE LISTE À L'ÉCHELLE DU MONDE SE CHERCHE — ELLE NE SE FAIT PAS DÉFILER.
 *
 * ═══ CE QUE `<select>` DEVIENT À DEUX CENT QUARANTE-DEUX OPTIONS ═══
 *
 * Le même défaut que le calendrier natif, sous un autre nom : le panneau du
 * navigateur s'ouvre HORS de toute feuille de style, à l'altitude que le
 * système lui donne, et il recouvre ce qu'il y a autour. Mesuré dans la modale
 * de correction du parc : le panneau des pays s'ouvre du haut de la fenêtre
 * jusqu'en bas, masque le titre, la description, le nom du parc et les deux
 * champs qui suivent. On choisit son pays à l'aveugle, dans un formulaire dont
 * on ne voit plus rien.
 *
 * Et il ne se cherche pas. Le natif saute bien à la frappe, au clavier — mais
 * ce saut est un préfixe strict, sans filtre et sans retour visible, et la
 * souris comme le tactile n'y ont pas droit du tout. `Combobox` existe pour
 * cela, et son en-tête pose la règle mot pour mot : « un `<select>` natif suffit
 * tant que la liste tient sous les yeux. À deux cent cinquante indicatifs, il ne
 * suffit plus. »
 *
 * ═══ POURQUOI CETTE GARDE, ET POURQUOI MAINTENANT ═══
 *
 * La règle était écrite, appliquée à l'inscription — deux champs, le pays et
 * l'indicatif — et jamais vérifiée. `SignUp.tsx` va jusqu'à la formuler comme
 * une doctrine : « le champ cherchable est déjà celui de l'indicatif, deux
 * champs plus haut — LA MÊME NOTION MÉRITE LE MÊME GESTE. » La modale du parc
 * pose exactement la même question, avec exactement la même liste, et l'a posée
 * dans un `<select>` nu.
 *
 * C'est le troisième exemplaire de la même histoire dans ce dépôt : une
 * migration menée à la main, racontée par des commentaires, vérifiée par rien,
 * et un champ resté en arrière. Le contrôle est textuel et il l'assume — un
 * écran qu'aucun test ne monte ne se contrôle pas autrement, et la modale de
 * correction du parc n'était atteignable en démonstration que depuis peu.
 *
 * LA CONDITION PORTE SUR LA SOURCE DE LA LISTE, non sur son contenu : ce sont
 * `countryOptions` et `dialOptions` qui la font mondiale, et elles sont les
 * seules. Un jour où une troisième naîtra, c'est ici qu'elle se déclarera.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/**
 * Les deux constructeurs qui rendent une liste à l'échelle du monde.
 *
 * Assemblés plutôt qu'écrits en clair, comme la garde des dates : ce fichier ne
 * doit pas être son propre coupable, et la chaîne cherchée doit être exactement
 * celle qu'on exige de trouver ailleurs.
 */
const MONDIALES = [['country', 'Options('].join(''), ['dial', 'Options('].join('')]

/** Le composant CHERCHABLE : sa présence est ce que la règle demande. */
const CHERCHABLE = ['Com', 'bobox'].join('')

/**
 * `lib/countries.ts` DÉFINIT les deux fonctions ; il ne les rend pas.
 *
 * C'est la seule exemption, et elle est de nature : le fichier qui produit la
 * liste n'a pas d'interface à offrir. Tout autre ajout ici viderait la garde.
 */
const DEFINITION = 'lib/countries.ts'

function sources(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) sources(chemin, trouves)
    else if (/\.tsx?$/.test(entree.name)) trouves.push(chemin)
  }
  return trouves
}

/** Les commentaires ont le droit de citer ce qu'ils décrivent. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('les listes à l’échelle du monde', () => {
  /*
    LES TESTS SONT ÉCARTÉS, ET POUR LA MÊME RAISON QUE DANS `check-i18n`.

    Un test qui appelle `countryOptions` construit une FIXTURE — il vérifie le
    tri, le groupement, les noms — et n'a aucune interface à rendre. L'y
    contraindre ferait exiger un composant d'un fichier qui n'en monte pas.
  */
  const fichiers = sources(SRC).filter(
    (f) => !f.endsWith(DEFINITION) && !/\.test\.tsx?$/.test(f),
  )

  /* GARDE DE LA GARDE — un balayage vide passerait vert en ne lisant rien. */
  it('sont cherchées dans une source non vide', () => {
    expect(fichiers.length, 'aucun fichier source balayé').toBeGreaterThan(100)
  })

  /* GARDE DE LA GARDE — et une source où PERSONNE ne rend ces listes rendrait
     le contrôle suivant vrai par vacuité. Deux champs les rendent aujourd'hui
     à l'inscription ; le jour où plus aucun ne le fait, la règle n'a plus
     d'objet et doit être retirée, pas laissée verte. */
  it('sont bien rendues quelque part', () => {
    const rendeurs = fichiers.filter((f) => {
      const source = sansCommentaires(readFileSync(f, 'utf8'))
      return MONDIALES.some((appel) => source.includes(appel))
    })
    expect(rendeurs.length, 'aucun écran ne rend de liste mondiale').toBeGreaterThan(0)
  })

  it('se cherchent au clavier, jamais dans un menu du navigateur', () => {
    const fautifs = fichiers
      .filter((f) => {
        const source = sansCommentaires(readFileSync(f, 'utf8'))
        if (!MONDIALES.some((appel) => source.includes(appel))) return false
        return !source.includes(CHERCHABLE)
      })
      .map((f) => f.replace(SRC + '/', ''))

    expect(
      fautifs,
      'ces écrans font défiler deux cent quarante-deux pays dans un panneau du système',
    ).toEqual([])
  })
})
