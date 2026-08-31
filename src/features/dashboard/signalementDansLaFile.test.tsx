import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { WORKS } from '@/data/portfolio'

/**
 * LE SIGNALEMENT ATTEINT L'ÉCRAN OÙ LE BAILLEUR ARRIVE.
 *
 * ═══ CE QUE LA PASTILLE NE SUFFIT PAS À FAIRE ═══
 *
 * Le lot précédent a fait remonter le signalement du locataire jusqu'aux
 * notifications : la pastille de la barre latérale compte, et l'écran
 * « Signalements » le montre. Le bailleur, lui, a écrit ceci après s'être
 * connecté : « je n'ai pas eu de notification sur le dernier signalement ».
 *
 * Il n'avait pas tort. Il arrive sur le TABLEAU DE BORD, et la file du jour —
 * « ce qui vous attend aujourd'hui » — porte les impayés, les cautions à
 * arbitrer, les devis et les relevés manquants. Pas les signalements. Une fuite
 * déclarée le matin ne paraissait donc nulle part sur l'écran d'arrivée, et il
 * fallait aller la chercher dans un onglet qu'on n'ouvre que si l'on a déjà un
 * doute — ou remarquer un chiffre dans une barre latérale.
 *
 * ═══ CE QU'ON Y MET, ET CE QU'ON N'Y MET PAS ═══
 *
 * Les signalements ENCORE À CHIFFRER, c'est-à-dire ceux que personne n'a
 * touchés. Un chantier déjà chiffré attend un arbitrage, et la file porte déjà
 * cette entrée-là — l'y compter deux fois ferait lire deux dettes pour une.
 *
 * L'écran des travaux tient exactement ce compte, sous « 1 encore à chiffrer ».
 * Il existait ; il ne remontait pas d'un cran.
 */
describe('la file du jour', () => {
  it('porte les signalements que personne n’a encore chiffrés', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    const aChiffrer = WORKS.filter((w) => w.status === 'reported')
    expect(aChiffrer.length, 'le jeu ne porte aucun signalement à chiffrer').toBeGreaterThan(0)

    /* La file est une `section` nommée par son titre — « À traiter ». */
    const file = screen.getByRole('region', { name: /à traiter/i })
    expect(
      within(file).getByText((texte) => texte.includes('signalement') && texte.includes(String(aChiffrer.length))),
      'une fuite déclarée le matin ne paraît nulle part sur l’écran d’arrivée',
    ).toBeInTheDocument()
  })

  it('mène aux travaux, où le chiffrage se fait', async () => {
    await renderApp('/demo')
    await attendreLeChargement()

    const file = screen.getByRole('region', { name: /à traiter/i })
    expect(within(file).getByRole('link', { name: /chiffrer/i })).toHaveAttribute(
      'href',
      '/demo/travaux',
    )
  })
})
