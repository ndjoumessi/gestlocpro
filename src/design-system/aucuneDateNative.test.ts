import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUN SÉLECTEUR DE DATE DU NAVIGATEUR DANS CE PRODUIT.
 *
 * ═══ CE QUE `<input type="date">` FAIT, ET QU'ON NE PEUT PAS CORRIGER ═══
 *
 * Il ouvre le calendrier du SYSTÈME : ses polices, son bleu, ses flèches, sa
 * géométrie. Aucune feuille de style ne l'atteint. C'est déjà la raison d'être
 * de `DatePicker`, dont l'en-tête le dit — mais la migration qui l'a écrit n'a
 * pas fini le travail, et un champ est resté.
 *
 * Le symptôme était NOMMÉ ailleurs dans le dépôt avant d'être vu : « il ouvrait
 * donc le panneau du navigateur dans la modale même » (`gestures.test.tsx`).
 * Dans la modale des prix de refacturation, ce panneau s'ouvrait VERS LE HAUT et
 * recouvrait le titre, la description et le champ au-dessus — l'utilisateur
 * perdait de vue ce qu'il était en train de renseigner.
 *
 * ═══ POURQUOI CETTE GARDE N'EXISTAIT PAS, ET POURQUOI ELLE DEVAIT ═══
 *
 * La migration a été faite à la main, fichier par fichier, et vérifiée à l'œil.
 * Trois commentaires du dépôt racontent l'opération ; aucun ne la VÉRIFIE. Un
 * seul champ oublié suffit à rendre le travail invisible : l'écran fautif n'est
 * pas celui qu'on rouvre, et le panneau du navigateur ressemble assez à un
 * calendrier pour ne pas alerter.
 *
 * Le contrôle est textuel et il l'assume : il lit la source. C'est le seul
 * moyen de couvrir des fichiers que rien ne rend — la modale des prix n'a été
 * atteignable en démonstration que depuis un lot récent.
 */

const ICI = dirname(fileURLToPath(import.meta.url))
const SRC = join(ICI, '..')

/** Le composant qui REMPLACE l'entrée native a le droit de la nommer. */
const AUTORISES = ['DatePicker.tsx', 'datepicker.test.tsx', 'aucuneDateNative.test.ts']

function sources(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) sources(chemin, trouves)
    else if (/\.tsx?$/.test(entree.name)) trouves.push(chemin)
  }
  return trouves
}

/** Les commentaires ont le droit de citer ce qu'ils proscrivent. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/* Assemblé, jamais écrit en clair : ce fichier ne doit pas être son propre
   faux positif, et la chaîne cherchée est exactement celle qu'on interdit. */
const NATIF = ['type="', 'date', '"'].join('')

describe('les champs de date', () => {
  const fichiers = sources(SRC).filter(
    (f) => !AUTORISES.some((nom) => f.endsWith(nom)),
  )

  /* GARDE DU GARDE — la liste doit contenir quelque chose. Un chemin qui cesse
     de correspondre viderait le balayage, et zéro fichier passeraient zéro
     contrôle en se déclarant verts. */
  it('sont cherchés dans une source non vide', () => {
    expect(fichiers.length, 'aucun fichier source balayé').toBeGreaterThan(100)
  })

  it('n’emploient jamais le calendrier du navigateur', () => {
    const fautifs = fichiers
      .filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(NATIF))
      .map((f) => f.replace(SRC + '/', ''))

    expect(
      fautifs,
      'ces champs ouvrent le panneau du système, hors de toute feuille de style',
    ).toEqual([])
  })
})
