import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { convertir } from './currencies'

/**
 * LA PARITÉ LÉGALE NE SE DEMANDE À PERSONNE.
 *
 * ═══ CE QUI ÉTAIT FAUX ═══
 *
 * Le lot de la conversion a fait venir TOUS les cours de `/api/rates`, la parité
 * du franc CFA comprise. Un client sans son API — le développement seul, un
 * incident réseau, un déploiement où le service tarde — annonçait donc « Cours
 * indisponibles » pour convertir 447 000 FCFA en euros, alors que ce calcul-là
 * n'a jamais eu besoin d'un serveur : 655,957, fixé par le traité de coopération
 * monétaire, exact et sans date.
 *
 * Le défaut portait précisément sur la paire qui sert le marché visé. Le dollar
 * canadien manquant est une gêne ; l'euro manquant sur un parc de Douala est le
 * produit qui ne fait pas ce qu'on lui demande, pour une valeur qu'il connaît.
 *
 * ═══ CE QUE CE FICHIER TIENT, ET SON CONTREPOIDS ═══
 *
 * Que la parité vive dans le client. ET que cette avance s'arrête là : un
 * correctif qui aurait rendu tout « atteignable » en inventant des cours aurait
 * remis le défaut d'origine — quatre devises affichant le même nombre. Le
 * troisième cas mesure donc ce qui reste INatteignable sans flux.
 *
 * Une constante recopiée de part et d'autre peut diverger. La garde qui les
 * compare vit chez le SERVEUR — `server/src/taux/taux.test.ts` — parce que son
 * paquet a les types de Node, quand celui du client ne les a pas : lire un
 * fichier depuis un cas jsdom ne compile pas.
 */

describe('la parité du franc CFA', () => {
  /**
   * LE CAS DU DÉFAUT. `/rates` refuse, comme une API éteinte.
   */
  it('convertit en euros sans que le serveur réponde', async () => {
    const faux = installerFauxServeur()
    faux.quand('GET', '/rates', { status: 503, body: { error: 'indisponible' } })
    await renderApp('/demo')
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Réglages|Settings/ }))
    await user.click(screen.getByRole('button', { name: /^Devise|^Currency/ }))
    await user.click(screen.getByRole('option', { name: /Euro/ }))

    /* 447 000 francs valent 681 € à la parité légale. Le NOMBRE, et pas
       seulement le symbole : un ré-étiquetage garderait 447 000. */
    const principal = screen.getByRole('main').textContent?.replace(/[\s ]/g, ' ') ?? ''
    expect(principal, 'la parité a été demandée au serveur').toMatch(/681/)
    expect(principal, 'les francs sont restés sous un autre symbole').not.toMatch(/447 000/)
  })

  /**
   * LE CONTREPOIDS. Ce que le client NE sait PAS faire seul.
   *
   * Le dollar canadien et le dollar américain flottent : leur cours se publie,
   * il ne se déduit pas. Sans flux, ils restent inatteignables — et c'est
   * l'écran qui le dit, voir `choixDeDeviseHonore`.
   */
  it('n’ouvre pas la route des monnaies qui flottent', () => {
    expect(convertir(447_000, 'CFA', 'EUR', {}), 'l’euro exige un flux').toBe(68_145)
    expect(convertir(447_000, 'CFA', 'CAD', {}), 'un cours flottant a été inventé').toBeNull()
    expect(convertir(447_000, 'CFA', 'USD', {}), 'un cours flottant a été inventé').toBeNull()
  })
})
