import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'

/**
 * LE TRI SE RETIENT DANS L'ADRESSE.
 *
 * Cinq écrans ont reçu un tri en deux jours, et les cinq commits portent la
 * même phrase sous « Ce que je peux avoir raté » : « le tri ne se retient pas
 * dans l'adresse ». Ce fichier est la réponse.
 *
 * CE QUE CELA ACHÈTE, et il faut le nommer parce que ce n'est pas la mémoire
 * d'une session : une vue filtrée qu'on PARTAGE — « regarde les deux cautions
 * en arbitrage » —, qu'on met en favori, et qui survit à un rechargement. Le
 * mois du parc l'a tranché avant nous, avec son argument : « il désigne une
 * vue stable qu'on partage ». La RECHERCHE reste locale pour la raison
 * inverse, écrite au même endroit : « une frappe en cours de saisie est
 * éphémère ». Ce lot ne la touche pas.
 *
 * ═══ POURQUOI CES CAS PROUVENT QUELQUE CHOSE SOUS `MemoryRouter` ═══
 *
 * Le harnais n'a pas d'URL réelle : `leMoisAffiche.test.tsx` le dit déjà —
 * « une assertion sur `window.location.search` y passerait au vert quoi qu'il
 * arrive ». Ces cas n'en posent donc aucune. Ils partent d'une adresse et
 * exigent la vue qu'elle promet : un tri resté dans un `useState` ignorerait
 * l'adresse et rendrait le parc entier. C'est la seule chose à prouver, et
 * elle se prouve dans ce sens-là.
 */

/** La pastille pressée d'un groupe de tri — celle qui porte `aria-pressed`. */
function pastillePressee(groupe: HTMLElement): string {
  const pressees = within(groupe)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
  expect(pressees, 'un groupe de tri presse exactement une pastille').toHaveLength(1)
  return pressees[0]!.textContent?.trim() ?? ''
}

function groupe(nom: RegExp): HTMLElement {
  return within(screen.getByRole('main')).getByRole('group', { name: nom })
}

describe('le tri se retient dans l’adresse', () => {
  it('ouvre les cautions sur l’état que porte l’adresse', async () => {
    await renderApp('/demo/cautions?etat=settling')
    await attendreLeChargement()

    expect(pastillePressee(groupe(/Statut|Status/))).toMatch(/arbitrage|Settling/i)

    /* ET LA LISTE SUIT, pas seulement la peinture de la pastille : une
       pastille pressée au-dessus d'un registre entier serait un mensonge plus
       coûteux que l'absence de tri. */
    const lignes = within(screen.getByRole('main')).getAllByRole('row').length - 1
    const total = within(screen.getByRole('main')).getAllByRole('button', { name: /^Toutes|^All/ })
    expect(lignes, 'l’adresse ne rend que les cautions en arbitrage').toBeLessThan(
      Number(/(\d+)\s*$/.exec(total[0]!.textContent ?? '')![1]),
    )
  })

  it('ne vide pas l’écran sur une valeur qu’il ne connaît pas', async () => {
    /* UNE ADRESSE PARTAGÉE VIEILLIT. « ?etat=settling » envoyé un mardi peut
       arriver sur un parc où plus rien n'est en arbitrage : la pastille
       n'existe plus — les options se dérivent des états PRÉSENTS — et un tri
       qui s'appliquerait quand même rendrait un écran vide sous aucune
       pastille pressée. On retombe donc sur « Toutes ». */
    await renderApp('/demo/cautions?etat=ceci-nest-pas-un-etat')
    await attendreLeChargement()
    expect(pastillePressee(groupe(/Statut|Status/))).toMatch(/^Toutes|^All/)
  })

  it('ouvre les travaux sur SES DEUX axes à la fois', async () => {
    await renderApp('/demo/travaux?origine=tenantReport&etat=quoted')
    await attendreLeChargement()

    expect(pastillePressee(groupe(/origine|origin/i))).toMatch(/Signalées|Reported/)
    expect(pastillePressee(groupe(/par état|by status/))).toMatch(/Devis proposé|Quoted/)
  })

  it('ouvre le registre des accès sur le rôle que porte l’adresse', async () => {
    await renderApp('/demo/acces?role=manager')
    await attendreLeChargement()
    expect(pastillePressee(groupe(/par rôle|by role/i))).toMatch(/Gestionnaire|Manager/)
    expect(document.querySelectorAll('[data-fiche-membre]').length).toBe(1)
  })

  it('ouvre les locataires sur l’état de paiement que porte l’adresse', async () => {
    await renderApp('/demo/locataires?etat=overdue')
    await attendreLeChargement()
    expect(pastillePressee(groupe(/Ce mois|This month/))).toMatch(/retard|Overdue/i)
  })

  it('ouvre les paiements sur l’état que porte l’adresse', async () => {
    /* CELUI-CI NE DÉRIVE PAS SES OPTIONS DE LA PRÉSENCE : le groupe rend les
       quatre états, y compris ceux qu'aucun bail ne porte. Une adresse sur un
       état vide y donne donc une grille vide MAIS trois pastilles pour en
       sortir — faux sans être piégeant, ce que les autres écrans ne peuvent
       pas se permettre. */
    await renderApp('/demo/paiements?etat=overdue')
    await attendreLeChargement()
    expect(pastillePressee(groupe(/Statut|Status/))).toMatch(/retard|Overdue/i)
  })

  it('ouvre les signalements sur la vue que porte l’adresse', async () => {
    await renderApp('/demo/signalements?tri=nonLues')
    await attendreLeChargement()
    expect(pastillePressee(groupe(/Signalements|Reports/))).toMatch(/Non lues|Unread/)
  })
})
