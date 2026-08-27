import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { LONGUEUR_MINIMALE_DU_MOT_DE_PASSE, validatePassword } from './validation'

/**
 * LA RÈGLE DU MOT DE PASSE SE DIT AVANT L'ÉCHEC, ET DIT LE BON NOMBRE.
 *
 * ═══ CE QUE LES DEUX ÉCRANS FAISAIENT ═══
 *
 * `validatePassword(…, { requireStrong: true })` refuse en dessous de huit
 * caractères, et RIEN ne l'annonçait. La jauge de force ne rend rien tant que
 * la valeur est vide — `if (!value) return null` — et quand elle rend, elle dit
 * « faible / correct / bon / fort », jamais le seuil qui fait refuser. On
 * découvrait donc la règle en la violant, alors que le champ de confirmation,
 * juste dessous, portait son aide depuis toujours.
 *
 * Le défaut était identique, mot pour mot, sur l'inscription et sur la
 * réinitialisation : c'est le même champ, le même validateur, la même omission.
 * D'où un seul fichier pour les deux — les séparer laisserait réparer l'un et
 * pas l'autre.
 *
 * ═══ CE QUE CES CAS GARDENT VRAIMENT ═══
 *
 * Pas la présence d'une phrase : la CONCORDANCE DE TROIS CHOSES qui pouvaient
 * diverger, et divergeaient. Le nombre vivait en triple — le `8` du validateur,
 * le « 8 » du message français, le « 8 » de l'anglais — donc trois endroits à
 * changer d'un coup et rien pour le rappeler.
 *
 * On exige donc que l'aide ET le refus nomment le nombre que le VALIDATEUR
 * applique, lu ici depuis la constante. Recoder un littéral dans l'une des
 * traductions passerait inaperçu aujourd'hui et rougirait au premier
 * déplacement du seuil.
 */

/** Les deux écrans qui exigent un mot de passe fort, et rien d'autre. */
const ECRANS = [
  { nom: 'inscription', adresse: '/inscription/proprietaire', libelle: /^Mot de passe/ },
  {
    nom: 'réinitialisation',
    adresse: '/reinitialiser?jeton=n8_JnTDL0lXhnNjlWVPjdGYs4Pl42h-m48bADguuBgE',
    libelle: /^Nouveau mot de passe/,
  },
] as const

/** Le champ, son aide, et le bloc qui les tient — `Field` les relie par `aria-describedby`. */
function aideDe(champ: HTMLElement): string {
  const ids = (champ.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  expect(ids.length, 'le champ ne décrit rien : aucune aide ne lui est reliée').toBeGreaterThan(0)
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('la règle du mot de passe', () => {
  for (const { nom, adresse, libelle } of ECRANS) {
    it(`${nom} : l’annonce avant toute saisie, avec le seuil du validateur`, async () => {
      await renderApp(adresse)
      await screen.findByRole('heading', { level: 1 })

      const champ = screen.getByLabelText(libelle)
      const aide = aideDe(champ)

      expect(aide, 'l’aide ne nomme pas le nombre que le validateur applique').toContain(
        String(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE),
      )
      /* Et elle est là AVANT toute interaction : c'est tout le point. Une aide
         qui n'apparaîtrait qu'après une frappe ne préviendrait de rien. */
      expect(champ).toHaveValue('')
    })

    it(`${nom} : le refus nomme le même nombre que l’aide`, async () => {
      const utilisateur = userEvent.setup()
      await renderApp(adresse)
      await screen.findByRole('heading', { level: 1 })

      const champ = screen.getByLabelText(libelle)
      /* Un caractère de moins que le seuil : la frontière, et non « court ».
         Un échantillon arbitraire resterait vrai si le seuil doublait. */
      await utilisateur.type(champ, 'a'.repeat(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE - 1))
      await utilisateur.tab()

      const refus = await screen.findByRole('alert')
      expect(refus.textContent, 'le refus ne nomme pas le seuil').toContain(
        String(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE),
      )
      /* Le marqueur d'interpolation ne doit surtout pas atteindre l'écran : le
         rendu d'erreur de l'inscription est GÉNÉRIQUE, il ignore quelle clé il
         traduit, et c'est le cas où l'on oublie de lui passer le paramètre. */
      expect(document.body.textContent).not.toMatch(/\{n\}/)
    })
  }

  /**
   * LA FRONTIÈRE, CÔTÉ VALIDATEUR.
   *
   * Les deux cas d'écran liraient le même nombre à l'aide et au refus même si
   * le validateur, lui, coupait ailleurs — ils comparent deux textes entre eux.
   * Celui-ci ancre la constante au COMPORTEMENT.
   */
  it('refuse un caractère sous le seuil, accepte le seuil', () => {
    const sous = 'a'.repeat(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE - 1)
    const juste = 'a'.repeat(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE)
    expect(validatePassword(sous, { requireStrong: true })).toBe('auth.errors.passwordShort')
    expect(validatePassword(juste, { requireStrong: true })).toBeNull()
  })
})

describe('l’aide ne remplace pas le refus', () => {
  it('les deux se lisent ensemble, l’aide d’abord', async () => {
    const utilisateur = userEvent.setup()
    await renderApp('/reinitialiser?jeton=n8_JnTDL0lXhnNjlWVPjdGYs4Pl42h-m48bADguuBgE')
    await screen.findByRole('heading', { level: 1 })

    const champ = screen.getByLabelText(/^Nouveau mot de passe/)
    await utilisateur.type(champ, 'a'.repeat(LONGUEUR_MINIMALE_DU_MOT_DE_PASSE - 1))
    await utilisateur.tab()
    await screen.findByRole('alert')

    /* `Field` relie l'aide ET l'erreur par `aria-describedby`, dans cet ordre :
       l'aide explique, l'erreur corrige, et un lecteur d'écran doit entendre
       les deux. Un refus qui REMPLACERAIT l'aide retirerait la règle au moment
       précis où elle sert. */
    const decrits = (champ.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    expect(decrits.length, 'l’aide ou le refus a disparu de la description').toBe(2)
    const bloc = document.getElementById(decrits[0]!)!
    expect(within(bloc).queryByRole('alert'), 'l’aide est annoncée AVANT le refus').toBeNull()
  })
})
