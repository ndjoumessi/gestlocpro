import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'

/**
 * ON ÉMET UN CODE POUR LE LOGEMENT OÙ LE LOCATAIRE VIT DÉJÀ.
 *
 * ═══ LE PRODUIT SE CONTREDISAIT LUI-MÊME ═══
 *
 * La modale de création d'une fiche dit, mot pour mot : « La fiche rattache le
 * locataire à son logement. Pour lui ouvrir son espace, émettez ensuite un code
 * depuis Inviter par code. » On suit l'instruction, et le logement qu'on vient
 * de rattacher a DISPARU de la liste : `InviteModal` n'offrait que
 * `units.filter((u) => !u.tenant)`.
 *
 * Le geste que le produit prescrit était donc impossible. Signalé sur la
 * production : « je crée le locataire, je choisis un logement, ensuite il est
 * impossible de générer le code qui va le servir à s'inscrire ».
 *
 * ═══ POURQUOI C'ÉTAIT UN FILTRE ET NON UN OUBLI ═══
 *
 * Le mot « vacants » raconte une lecture : inviter, ce serait faire ENTRER
 * quelqu'un dans un logement libre. C'est un des deux cas. L'autre — celui de
 * tout parc existant, donc de tout nouveau compte — est un locataire déjà en
 * place à qui l'on ouvre son espace. Le serveur, lui, n'a jamais rien exigé de
 * tel : il vérifie que l'unité appartient au parc, et c'est tout.
 *
 * ═══ CE QUE CE CAS NE GARDE PAS ═══
 *
 * Que le code fonctionne. Rattacher la fiche au compte est l'affaire du
 * serveur, gardée par `leCodeAtteintLaFiche.test.ts`. Ici, seulement : le
 * logement occupé est PROPOSABLE.
 */
describe('la modale d’invitation', () => {
  it('propose aussi les logements OCCUPÉS, pas seulement les vacants', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/app/locataires')

    await utilisateur.click(await screen.findByRole('button', { name: /inviter par code/i }))
    const modale = await screen.findByRole('dialog')
    const choix = within(modale).getByRole('combobox', { name: /logement concerné/i })

    const proposes = within(choix)
      .getAllByRole('option')
      .map((o) => o.textContent?.trim() ?? '')

    /* Le jeu de démonstration a bien plus de logements occupés que de vacants :
       un seul choix proposé signait le filtre. On exige donc qu'il y en ait
       plus d'un, et que A1 — occupé dans la démonstration — en soit. */
    expect(proposes.length, 'la liste n’offre qu’un logement : le filtre est encore là').toBeGreaterThan(1)
    expect(
      proposes.some((p) => p.startsWith('A1')),
      'un logement occupé n’est pas proposé : impossible d’ouvrir son espace à qui vit déjà là',
    ).toBe(true)
  })

  it('dit qui occupe le logement, pour qu’on ne se trompe pas de personne', async () => {
    /* Les logements se nomment « A1 », « B2 » : proposer une liste d'étiquettes
       nues obligerait à mémoriser qui habite où avant d'émettre un code qui
       n'est lisible qu'une fois. Le nom de l'occupant est la seule chose qui
       distingue le bon choix du mauvais. */
    const utilisateur = userEvent.setup()
    await renderApp('/app/locataires')

    await utilisateur.click(await screen.findByRole('button', { name: /inviter par code/i }))
    const modale = await screen.findByRole('dialog')
    const choix = within(modale).getByRole('combobox', { name: /logement concerné/i })

    const occupe = within(choix)
      .getAllByRole('option')
      .find((o) => (o.textContent ?? '').startsWith('A1'))
    expect(occupe?.textContent, 'l’option ne nomme pas son occupant').toMatch(/A1\s*—\s*\S/)
  })
})
