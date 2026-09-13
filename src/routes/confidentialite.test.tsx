import { describe, expect, it } from 'vitest'
import SESSION from '../../server/src/auth/session.ts?raw'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { EDITEUR } from '@/legal/editeur'
import {
  CLES_DU_NAVIGATEUR,
  COOKIE_DE_SESSION,
  CONFIDENTIALITE_A_COMPLETER,
  SOUS_TRAITANTS,
} from '@/legal/confidentialite'

/**
 * LA POLITIQUE DE CONFIDENTIALITÉ, VUE DE L'ÉCRAN ET TENUE PAR LE CODE.
 *
 * Une politique de confidentialité ment de deux façons : en disant ce que le
 * produit ne fait pas, et en taisant ce qu'il fait. La page ne peut tenir la
 * première que par relecture. La seconde, en partie, se garde : ces cas relisent
 * le cookie du serveur et les clés du navigateur, et refusent qu'ils bougent
 * sans que la page bouge avec eux.
 *
 * Les sources sont lues par `?raw`, pas par `node:fs` : ce fichier MONTE la page,
 * il lui faut les types du DOM — voir `indicateursEnDouble.test.tsx`.
 */
/* Ni les cas, ni `src/test/` qui les sert, ni `src/legal/` qui DÉCLARE les clés —
   son commentaire cite `gestlocpro.vercel.app`, qui n'en est pas une. */
const SOURCES = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/test/**', '!/src/legal/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('la politique de confidentialité', () => {
  it('nomme le responsable du traitement, et le moyen de le joindre', async () => {
    await renderApp('/confidentialite')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Politique de confidentialité')
    const responsable = screen.getByRole('region', { name: 'Responsable du traitement' })
    expect(within(responsable).getByText(EDITEUR.entrepreneur, { exact: false })).toBeInTheDocument()
    for (const ligne of EDITEUR.adresse) {
      expect(within(responsable).getByText(ligne)).toBeInTheDocument()
    }
  })

  /* Les locataires saisis par un bailleur ne sont pas les clients de l'éditeur :
     le bailleur en est responsable, l'éditeur son sous-traitant. Taire cette
     distinction enverrait un locataire frapper à la mauvaise porte. */
  it('dit qui est responsable des données des locataires', async () => {
    await renderApp('/confidentialite')
    const roles = screen.getByRole('region', { name: 'Qui décide de quoi' })
    expect(roles.textContent).toMatch(/sous-traitant/)
    expect(roles.textContent).toMatch(/bailleur/)
  })

  it('nomme chaque prestataire qui reçoit des données, son rôle et son pays', async () => {
    await renderApp('/confidentialite')
    const destinataires = screen.getByRole('region', { name: 'Destinataires' })

    for (const sousTraitant of SOUS_TRAITANTS) {
      const nom = within(destinataires).getByText(sousTraitant.nom)
      expect(nom.closest('li')?.textContent).toMatch(/États-Unis/)
    }
    /* Twilio sait envoyer des SMS dans le code, mais n'est pas configuré en
       production : le nommer serait dire qu'il reçoit des numéros. Les autres
       sont des services qu'on s'attend à trouver sur un site, et qu'il n'utilise
       pas. */
    const page = screen.getByRole('main').textContent ?? ''
    for (const absent of [/Twilio/i, /Google/i, /Sentry/i, /Stripe/i, /analytics/i]) {
      expect(page, `la page nomme ${absent}, que le produit n’utilise pas`).not.toMatch(absent)
    }
  })

  it('déclare l’unique cookie, celui que le serveur pose', async () => {
    expect(SESSION).toContain(`export const NOM_COOKIE = '${COOKIE_DE_SESSION}'`)
    const cookies = [...SESSION.matchAll(/res\.cookie\(/g)]
    expect(cookies.length, 'le serveur pose un cookie de plus que la page ne déclare').toBe(1)

    await renderApp('/confidentialite')
    const stockage = screen.getByRole('region', { name: 'Cookies et stockage du navigateur' })
    expect(within(stockage).getByText(COOKIE_DE_SESSION)).toBeInTheDocument()
  })

  /* LA GARDE QUI VIEILLIRA LE MIEUX : une clé de stockage ajoutée au produit
     sans être déclarée ici fait rougir ce cas. */
  it('déclare chaque clé que le navigateur garde, ni plus ni moins', () => {
    const cles = new Set<string>()
    for (const texte of Object.values(SOURCES)) {
      for (const m of texte.matchAll(/['"`](gestlocpro\.[a-zA-Z.]+)['"`]/g)) {
        cles.add(m[1]!)
      }
    }
    expect(cles.size, 'aucune clé lue — la lecture est cassée, pas le produit').toBeGreaterThan(0)
    expect([...cles].sort()).toEqual(Object.keys(CLES_DU_NAVIGATEUR).sort())
  })

  it('dit que l’adresse électronique mémorisée survit à la déconnexion', async () => {
    await renderApp('/confidentialite')
    const stockage = screen.getByRole('region', { name: 'Cookies et stockage du navigateur' })
    expect(stockage.textContent).toMatch(/adresse électronique/)
    expect(stockage.textContent).toMatch(/déconnexion/)
  })

  it('dit la conservation telle qu’elle est, et les droits avec leur adresse', async () => {
    expect([...CONFIDENTIALITE_A_COMPLETER]).toEqual(['courriel'])

    await renderApp('/confidentialite')
    const conservation = screen.getByRole('region', { name: 'Durée de conservation' })
    /* Rien n'est purgé : la page ne promet aucune durée qu'aucun code ne tient. */
    expect(conservation.textContent).toMatch(/aucune suppression automatique/i)
    expect(conservation.textContent).not.toMatch(/\d+\s*(ans?|mois)\b/)

    const droits = screen.getByRole('region', { name: 'Vos droits' })
    expect(within(droits).getByRole('link', { name: /CNIL/ })).toHaveAttribute('href', 'https://www.cnil.fr/fr/plaintes')
    /* Aucun courriel, ni celui de l'éditeur qui n'existe pas, ni celui d'un
       prestataire recopié par mégarde. */
    expect(screen.getByRole('main').textContent).not.toMatch(/@/)
  })

  it('se lit en anglais', async () => {
    await renderApp('/confidentialite', { locale: 'en' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy policy')
    expect(screen.getByRole('region', { name: 'Your rights' })).toBeInTheDocument()
  })

  it('s’ouvre depuis le pied de la vitrine', async () => {
    await renderApp('/')
    const pied = screen.getByRole('contentinfo')
    await userEvent.setup().click(within(pied).getByRole('link', { name: 'Confidentialité' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Politique de confidentialité')
  })
})
