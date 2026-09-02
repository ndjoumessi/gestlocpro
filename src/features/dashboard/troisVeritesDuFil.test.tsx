import { beforeEach, describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, userEvent } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'

/**
 * TROIS PHRASES QUI ONT CESSÉ D'ÊTRE VRAIES.
 *
 * ═══ CE QUE LA MODALE D'INVITATION PROMETTAIT ═══
 *
 * « Un gestionnaire délégué opère TOUT le parc : chaque immeuble, chaque bail,
 * chaque locataire. Le périmètre ne peut pas être limité à un logement. »
 *
 * Les deux affirmations sont mortes. Le périmètre se limite aux immeubles,
 * aux LOGEMENTS, et se retranche par exclusion — quatre lots de cette semaine.
 * Et un gestionnaire qui arrive ne voit RIEN tant qu'on ne lui a rien confié,
 * depuis le lot d'aujourd'hui.
 *
 * Une note qui ment au moment où l'on décide est pire qu'une note absente : on
 * la lit précisément pour décider.
 *
 * ═══ ET LE RÉGLAGE DES COPIES PROMETTAIT PLUS LARGE ═══
 *
 * « Copies par e-mail » laisse entendre TOUS les courriels. Il n'en couvre
 * qu'une famille : le fil des signalements. Une relance de loyer part quoi
 * qu'il arrive, et c'est voulu — un impayé n'est pas une conversation.
 */

const PARC = '11111111-2222-4333-8444-555555555555'

const session: EtatSession = {
  statut: 'connecte',
  compte: { ...COMPTE_FICTIF, threadEmailOptIn: true },
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc Bastos', currency: 'XAF' }],
}

beforeEach(() => {
  /* Le faux serveur est POSÉ sans être interrogé : la démonstration n'appelle
     personne, et l'écran connecté n'a besoin que d'une session. Sans lui, les
     appels de démarrage partiraient dans le vide. */
  installerFauxServeur()
})

describe('la note du gestionnaire, à l’invitation', () => {
  it('dit qu’il ne verra RIEN tant qu’on ne lui a rien confié', async () => {
    /* La DÉMONSTRATION porte la même modale et n'a besoin d'aucun serveur —
       c'est aussi par elle que `modales.mjs` l'ouvre. */
    await renderApp('/demo/locataires')
    await attendreLeChargement()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Inviter par code/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Rôle invité/ }), 'manager')

    /* Le texte de la BOÎTE, et non un nœud : la note peut être découpée par ses
       guillemets, et c'est ce que le lecteur voit qui compte. */
    const boite = screen.getByRole('dialog')
    expect(
      boite.textContent,
      'elle promettait « opère TOUT le parc » — c’est faux depuis ce matin',
    ).toMatch(/ne verra rien tant que/i)
  })

  it('ne promet plus qu’un périmètre ne puisse pas descendre au logement', async () => {
    /* Il y descend, et il s’en retranche : quatre lots de cette semaine. */
    /* La DÉMONSTRATION porte la même modale et n'a besoin d'aucun serveur —
       c'est aussi par elle que `modales.mjs` l'ouvre. */
    await renderApp('/demo/locataires')
    await attendreLeChargement()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Inviter par code/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Rôle invité/ }), 'manager')

    const boite = screen.getByRole('dialog')
    expect(boite.textContent).not.toMatch(/ne peut pas être limité/i)
  })
})

describe('le réglage des copies', () => {
  it('nomme ce qu’il couvre, et pas plus', async () => {
    await renderApp('/app', { session })
    await attendreLeChargement()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: new RegExp(COMPTE_FICTIF.fullName) }))

    const item = screen.getByRole('menuitemcheckbox', { name: /copies/i })
    expect(
      item.textContent,
      '« Copies par e-mail » laissait entendre TOUS les courriels ; une relance ' +
        'de loyer part quoi qu’il arrive',
    ).toMatch(/signalement/i)
  })
})
