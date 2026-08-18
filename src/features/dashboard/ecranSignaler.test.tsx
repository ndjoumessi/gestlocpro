import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement } from '@/test/render'

/**
 * L'écran « Signaler », que la maquette du portail décrit.
 *
 * Le formulaire existait, en MODALE posée sur l'écran des travaux. La maquette
 * en fait un écran, et pour une raison qui n'est pas cosmétique : elle y adosse
 * « Mes signalements ». Un locataire qui déclare veut d'abord savoir si le
 * précédent a été traité — sans cette liste, il redéclare ce qui est en cours.
 */
describe('écran Signaler', () => {
  it('est proposé au locataire, et liste SES signalements', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/signaler/i)
    expect(screen.getByRole('button', { name: /signaler un problème/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/mes signalements/i)
  })

  it('n’expose jamais le montant des travaux', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    /**
     * « Le coût des travaux n'est jamais exposé au locataire », dit la maquette
     * en pied de page. Le devis regarde le bailleur ; ce qui intéresse le
     * locataire est où en est SA demande.
     */
    expect(screen.getByRole('main').textContent).not.toMatch(/FCFA|€/)
  })

  it('ne liste QUE les siens', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()
    await switchRole('tenant')
    await attendreLeChargement()

    /**
     * L'invariante de cloisonnement ne suffisait pas ici : elle traque les NOMS
     * des autres locataires, et une intervention n'en porte pas. Sans ce cas,
     * retirer le filtre ne faisait rien tomber — le locataire aurait vu les
     * pannes de tout l'immeuble sans qu'un test s'en aperçoive.
     *
     * « Fuite sous l'évier de la cuisine » appartient à A3 ; le locataire de la
     * démonstration occupe A1.
     */
    expect(screen.getByRole('main').textContent).not.toMatch(/évier de la cuisine/i)
  })

  it('n’offre pas de déclarer au bailleur, qui reçoit au lieu de signaler', async () => {
    renderApp('/demo/signaler')
    await attendreLeChargement()

    expect(screen.queryByRole('button', { name: /signaler un problème/i })).not.toBeInTheDocument()
  })
})
