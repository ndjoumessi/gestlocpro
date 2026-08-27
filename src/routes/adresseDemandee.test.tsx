import { describe, expect, it } from 'vitest'
import { renderApp, screen } from '@/test/render'

/**
 * L'ADRESSE DEMANDÉE EST L'ADRESSE, PAS SON CHEMIN.
 *
 * `AttemptedPath` ne rendait que `pathname`. Mesuré au navigateur sur
 * `/produits/ancienne-page?ref=lettre-2024&utm=mail`, l'écran affichait
 * « /produits/ancienne-page » sous le mot « Adresse demandée ».
 *
 * C'est la part supprimée qui dit LEQUEL des liens morts on vient de suivre —
 * une campagne, un courriel, un message. Son propre en-tête revendiquait deux
 * usages, corriger et signaler, et la coupure était exactement ce qui les
 * empêchait tous les deux.
 *
 * ═══ CE QUE CE FICHIER GARDE ═══
 *
 * Que l'adresse rendue soit celle qu'on a demandée, y compris ses paramètres ;
 * que la coupure de sûreté porte sur l'ENSEMBLE et non sur le seul chemin ; et
 * que le couple « nom / valeur » soit balisé comme tel. Rien de tout cela ne se
 * voit sur une capture : une adresse tronquée ressemble à une adresse.
 */
describe('l’adresse demandée', () => {
  it('rend les paramètres, et pas seulement le chemin', async () => {
    await renderApp('/produits/ancienne-page?ref=lettre-2024&utm=mail')

    const valeur = screen.getByText(/^\/produits\/ancienne-page/)
    expect(valeur).toHaveTextContent('ref=lettre-2024')
    expect(valeur).toHaveTextContent('utm=mail')
  })

  it('rend le fragment aussi', async () => {
    await renderApp('/une-page#section-3')
    expect(screen.getByText(/^\/une-page/)).toHaveTextContent('#section-3')
  })

  /**
   * LA COUPURE PORTE SUR L'ENSEMBLE.
   *
   * Elle existe pour qu'une adresse arbitrairement longue ne repousse pas les
   * boutons hors de l'écran. Appliquée au seul chemin — ce qu'elle faisait —,
   * elle laissait passer une chaîne de paramètres sans limite : la protection
   * gardait la moitié qui ne menaçait rien.
   */
  it('coupe l’ensemble, pas seulement le chemin', async () => {
    const parametres = 'x'.repeat(400)
    await renderApp(`/court?${parametres}`)

    const valeur = screen.getByText(/^\/court/)
    const rendu = valeur.textContent ?? ''
    expect(rendu.endsWith('…'), 'l’adresse démesurée n’est pas coupée').toBe(true)
    /* Le plafond est un détail d'implémentation ; ce qui doit tenir est qu'il
       existe et qu'il borne. On vérifie l'ordre de grandeur, pas le nombre. */
    expect(rendu.length).toBeLessThan(200)
  })

  it('lie le nom à sa valeur pour qui n’y voit rien', async () => {
    await renderApp('/nimportequoi')

    const terme = screen.getByText('Adresse demandée')
    expect(terme.tagName.toLowerCase(), 'le nom n’est pas un terme de définition').toBe('dt')
    const liste = terme.closest('dl')
    expect(liste, 'le couple ne vit pas dans une liste de définitions').not.toBeNull()
    expect(liste!.querySelectorAll('dd')).toHaveLength(1)
  })
})

/**
 * LA MARQUE : QUATRE UNITÉS, ET AUCUNE COULEUR ÉCRITE À LA MAIN.
 *
 * Le tracé retenu peint son fond en `#2563EB` et ses carrés en `#FFFFFF` — au
 * caractère près `--color-accent` et `--color-on-accent`. La tentation est donc
 * de recopier les deux valeurs dans le SVG : elles sont justes AUJOURD'HUI, et
 * le jour où l'accent bouge, la marque resterait seule sur l'ancienne teinte.
 * C'est très exactement ce qui venait d'arriver à la PROSE de ce composant, qui
 * parlait encore d'un « carré doré » plusieurs teintes après l'or.
 */
describe('la marque', () => {
  it('n’écrit aucune couleur, et hérite de son conteneur', async () => {
    await renderApp('/nimportequoi')

    const marque = document.querySelector('a[aria-label="GestLocPro"] svg')
    expect(marque, 'la marque n’est pas rendue').not.toBeNull()
    expect(marque).toHaveAttribute('fill', 'currentColor')

    const html = marque!.outerHTML
    expect(/#[0-9a-fA-F]{3,8}\b/.test(html), 'une couleur est écrite dans le tracé').toBe(false)
    expect(/rgb\(/.test(html), 'une couleur est écrite dans le tracé').toBe(false)
  })

  it('dit quatre unités dans des états différents', async () => {
    await renderApp('/nimportequoi')

    const carres = document.querySelectorAll('a[aria-label="GestLocPro"] svg rect')
    expect(carres).toHaveLength(4)
    /* Les opacités décroissantes SONT le second sens du signe — « plusieurs
       logements » d'un côté, « états différents » de l'autre. Quatre carrés
       identiques ne diraient plus que la moitié. */
    const opacites = new Set(Array.from(carres).map((r) => r.getAttribute('opacity') ?? '1'))
    expect(opacites.size, 'les quatre carrés sont identiques').toBeGreaterThan(1)
  })

  it('reste décorative : le nom est porté par le lien', async () => {
    await renderApp('/nimportequoi')

    const lien = screen.getAllByRole('link', { name: 'GestLocPro' })[0]!
    expect(lien.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
