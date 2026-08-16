import { describe, expect, it } from 'vitest'
import { computeKpis } from './kpis'
import { READINGS, UNITS } from './portfolio'

/**
 * Indicateurs du parc.
 *
 * `KPIS` était une constante écrite à la main. Ses chiffres étaient cohérents
 * entre eux — 375 000 d'impayé = 155 000 de partiel + 220 000 de retard — mais
 * reliés à aucune donnée : `expected` valait 1 415 000 quand la somme des
 * loyers occupés vaut 1 397 000. Rattacher un locataire ne les bougeait pas.
 */
describe('indicateurs calculés', () => {
  const kpis = computeKpis(UNITS, READINGS)

  it('somme réellement les loyers des unités occupées', () => {
    const attendu = UNITS.filter((u) => u.status !== 'vacant').reduce((s, u) => s + u.rent, 0)
    expect(kpis.expected).toBe(attendu)
    // L'ancienne constante : le voisinage des deux chiffres est le sujet.
    expect(kpis.expected).not.toBe(1415000)
  })

  it('rend un impayé qui est vraiment la différence', () => {
    // Il était un nombre à part, donc libre de dériver des deux autres.
    expect(kpis.outstanding).toBe(kpis.expected - kpis.collected)
  })

  it('ventile l’impayé sans en perdre ni en inventer', () => {
    expect(kpis.partial + kpis.late).toBe(kpis.outstanding)
  })

  it('compte le versement réel d’un règlement partiel', () => {
    // A5 : 40 000 sur 75 000. L'écran affichait 39 750 — 53 % du loyer —
    // pendant qu'une alerte annonçait 40 000 pour le même versement.
    const a5 = UNITS.find((u) => u.label === 'A5')!
    expect(a5.paid).toBe(40000)
    expect(a5.paid).not.toBe(Math.round(a5.rent * 0.53))
  })

  it('suit le parc quand celui-ci change', () => {
    // Le vrai défaut de la constante : elle ne bougeait jamais.
    const sansA1 = UNITS.filter((u) => u.label !== 'A1')
    expect(computeKpis(sansA1, READINGS).expected).toBeLessThan(kpis.expected)
  })

  it('rend 0 % et non NaN sur un parc vide', () => {
    // L'état exact d'un compte qui vient d'être créé.
    const vide = computeKpis([], [])
    expect(vide.occupancy).toBe(0)
    expect(Number.isNaN(vide.occupancy)).toBe(false)
    expect(vide.maxOverdueDays).toBe(0)
  })
})
