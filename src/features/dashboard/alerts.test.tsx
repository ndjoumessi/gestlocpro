import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { ALERTS } from '@/data/portfolio'

/**
 * Composition des messages d'alerte.
 *
 * `title` et `detail` étaient des phrases françaises complètes stockées dans la
 * donnée — « Devis plomberie à arbitrer », « Serge Mbarga · relance J+15 partie
 * le 04/08 ». Elles s'affichaient telles quelles dans l'interface anglaise.
 *
 * Chacune figeait trois choses à la fois, et c'est ce que ces tests gardent :
 * la **langue** du message, le **format de date** — « 04/08 » est le 4 août
 * ici et le 8 avril ailleurs —, et le **formatage monétaire**, qui doit suivre
 * la devise choisie.
 */
describe('messages d’alerte', () => {
  it('rend les titres dans la langue de l’interface', () => {
    renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/Quote awaiting your decision/)).toBeInTheDocument()
    expect(screen.getByText(/Partial payment recorded on A5/)).toBeInTheDocument()
  })

  it('accorde en nombre plutôt que de concaténer', () => {
    // « 2 relevés manquants » était écrit à la main, donc au pluriel même à un.
    renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/2 readings missing/)).toBeInTheDocument()
  })

  it('nomme le mois d’une période au lieu de le figer', () => {
    renderApp('/app/signalements', { locale: 'en' })
    // « août » était écrit dans la chaîne ; il se calcule désormais.
    expect(screen.getByText(/August 2026 receipt available/)).toBeInTheDocument()
  })

  it('rend une date de relance non ambiguë', () => {
    renderApp('/app/signalements', { locale: 'en', region: 'US' })
    // « 04/08 » se lisait 4 août ici et 8 avril là. Le mois est nommé, et
    // l'ordre reste celui du pays.
    expect(screen.getByText(/reminder sent on Aug 4/)).toBeInTheDocument()
  })

  it('porte l’année sur une échéance de bail', () => {
    renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getByText(/expires on 30\/09\/2026/)).toBeInTheDocument()
  })

  it('formate les montants dans la devise choisie', () => {
    renderApp('/app/signalements', { locale: 'en', currency: 'USD' })
    // Le montant était « 45 000 » en clair dans la chaîne : ni symbole, ni
    // groupement anglais, et insensible au changement de devise.
    expect(screen.getByText(/\$\s?45,000 proposed by the manager/)).toBeInTheDocument()
  })

  it('énumère les unités avec la conjonction de la langue', () => {
    renderApp('/app/signalements', { locale: 'en' })
    // « A5 et C2 » était figé dans le détail de l'alerte.
    expect(screen.getByText(/A5 and C2/)).toBeInTheDocument()
  })

  it('nomme la catégorie pour les lecteurs d’écran', () => {
    // Elle n'existait qu'en icône, et `Icon` est `aria-hidden` : la catégorie
    // était invisible à qui n'a pas l'image.
    renderApp('/app/signalements', { locale: 'en' })
    expect(screen.getAllByText('Meter reading').length).toBeGreaterThan(0)
  })

  /**
   * La pastille de navigation comptait « 2 » — un littéral, jamais recalculé.
   * L'état « lu » vivait dans l'écran, hors de portée de la barre latérale :
   * tout marquer comme lu laissait le compteur annoncer un travail qui n'existe
   * plus. Il est remonté dans le provider.
   */
  it('éteint la pastille de navigation quand tout est lu', async () => {
    renderApp('/app/signalements', { locale: 'en' })
    const nav = screen.getAllByRole('navigation')[0]

    /* TROIS et non deux : le jeu porte désormais un rappel de loyer non lu, en
       plus de l'impayé et du devis en attente. C'est un compte de JEU et non un
       invariant — il doit bouger avec lui, ce que le lot des relances n'avait
       pas prévu.
       On vise l'entrée « Reports » et non le texte « 3 » dans toute la barre :
       « Paiements » porte lui aussi une pastille à 3, et l'ancienne assertion ne
       tenait que parce que les deux nombres différaient. */
    const entree = () => within(nav).getByRole('link', { name: /Reports/ })
    expect(entree()).toHaveTextContent('3')

    await userEvent.click(screen.getByRole('button', { name: /Mark all as read/i }))

    expect(entree()).not.toHaveTextContent('3')
    expect(screen.getByText('All notifications are read.')).toBeInTheDocument()
  })

  it('ne laisse aucun message porter du français en anglais', () => {
    // Garde de fond : la donnée ne doit plus contenir de phrase du tout.
    for (const alert of ALERTS) {
      expect(alert).not.toHaveProperty('title')
      expect(alert).not.toHaveProperty('detail')
    }
  })
})
