import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * LE DOSSIER D'UN LOGEMENT SE LIT AU MOMENT D'UN DÉPART.
 *
 * ═══ CE QU'IL AFFIRMAIT SANS LE VÉRIFIER ═══
 *
 * La note de la carte « Caution » valait « à restituer en fin de bail » dès
 * qu'une caution EXISTAIT, quel que soit son état. Sur un logement dont le
 * locataire est parti et la caution rendue, le dossier annonçait donc détenir
 * un argent déjà reparti — sur l'écran de synthèse qu'on ouvre précisément
 * pour clore un bail.
 *
 * L'écran des cautions avait corrigé le même défaut ligne à ligne : « elle
 * portait "À restituer 250 000 FCFA" à côté d'une pastille "Restituée" — le
 * même fait nié à trois centimètres d'écart ». `caution.status` était là,
 * et ce fichier ne le lisait pas.
 *
 * ═══ ET CE QU'IL NE DISAIT PAS ═══
 *
 * Les deux lignes d'état des lieux ne portaient que leur DATE. Une date atteste
 * qu'on est passé ; ce qu'on cherche dans un dossier au moment d'un départ est
 * le nombre de RÉSERVES, qui décide seul d'une retenue sur la caution.
 */

/** Le texte de la carte d'indicateur dont l'intitulé correspond. */
function carte(intitule: RegExp): string {
  const boite = within(screen.getByRole('main'))
    .getAllByText(intitule)
    .map((noeud) => noeud.closest('[data-indicateur]'))
    .find((trouvee): trouvee is HTMLElement => trouvee !== null)
  expect(boite, `aucune carte intitulée ${intitule}`).toBeTruthy()
  return boite!.textContent ?? ''
}

describe('le dossier d’un logement', () => {
  it('dit une caution encore détenue comme à restituer', async () => {
    /* A1 : caution consignée, locataire en place — le cas ordinaire, et le
       contrepoids des deux suivants. Sans lui, une note vide passerait. */
    await renderApp('/demo/parc/A1')
    await attendreLeChargement()

    expect(carte(/^Caution consignée$/)).toContain('à restituer en fin de bail')
  })

  it('ne promet plus de restituer une caution déjà rendue', async () => {
    /* C3 : le locataire est parti, la caution est rendue. C'est le logement où
       la note d'avant devenait une affirmation fausse. */
    await renderApp('/demo/parc/C3')
    await attendreLeChargement()

    const note = carte(/^Caution consignée$/)
    expect(note, 'le dossier promet encore de restituer un argent rendu').not.toContain(
      'à restituer en fin de bail',
    )
    expect(note).toContain('déjà restituée')
  })

  it('dit l’arbitrage en cours au lieu de la fin de bail', async () => {
    /* A3 : caution en arbitrage — ni détenue tranquillement, ni rendue. Le
       troisième état du modèle, et celui qu'une note à deux cas oublierait. */
    await renderApp('/demo/parc/A3')
    await attendreLeChargement()

    expect(carte(/^Caution consignée$/)).toContain('arbitrage')
  })

  it('compte les réserves de chaque état des lieux, et pas seulement sa date', async () => {
    await renderApp('/demo/parc/A1')
    await attendreLeChargement()

    const dossier = within(screen.getByRole('main')).getByRole('list', {
      name: /pièces du dossier|file/i,
    })
    const texte = dossier.textContent ?? ''

    /* LA DATE RESTE — la ligne ne remplace rien, elle ajoute. */
    expect(texte).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    /* « Aucune réserve » est un fait, et le plus favorable : il se dit en
       toutes lettres plutôt que par un blanc. */
    expect(texte, 'les réserves de l’état des lieux ne se lisent pas').toMatch(
      /réserves?|Aucune réserve/,
    )
  })
})
