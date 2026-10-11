import { describe, expect, it } from 'vitest'
import VITRINE from '../../scripts/plafond-vitrine.mjs?raw'
import HAUTEURS from '../../scripts/plafond-hauteurs.mjs?raw'
import TEMOIN from '../../scripts/temoin-de-la-machine.mjs?raw'

/**
 * UN PLAFOND APPARTIENT À UNE MACHINE, ET LA PORTE LE SUPPOSAIT.
 *
 * ═══ CE QUE LA SUPPOSITION A COÛTÉ, LE 2026-09-27 ═══
 *
 * `plafond-vitrine` et `plafond-hauteurs` portent deux colonnes : `plafond`,
 * mesuré sur la machine de développement où `system-ui` vaut SF Pro, et
 * `plafondLarge`, mesuré sur la porte publique. Leurs en-têtes le disent depuis
 * des semaines — « aucun nombre ne vaut sur les deux ».
 *
 * À qui appartient la colonne se décidait pourtant ainsi :
 *
 *     const COLONNE_A_NOUS = !POLICE_LARGE || Boolean(process.env.CI)
 *
 * Sans commutateur, TOUTE machine était donc réputée être celle de
 * développement. Sur un conteneur d'exécution, `plafond-vitrine` a rendu quatre
 * plaintes — « 11 766 px pour un plafond de 11 400 » — et je les ai rapportées
 * comme une dette de la vitrine. Elles n'en étaient pas une : en remontant `src/`
 * au commit qui a INSCRIT 11 400, la même sonde mesure 11 781 px. Le nombre n'a
 * jamais été atteignable là, et sept commits consécutifs rendent exactement les
 * mêmes 11 766 — aucune croissance. Avec le commutateur, deux des quatre
 * plafonds sont exacts AU PIXEL et les quatre points sont verts.
 *
 * ═══ ET L'ASYMÉTRIE QUI RENDAIT LE DÉFAUT DANGEREUX ═══
 *
 * Le MOU consultait `COLONNE_A_NOUS` ; le DÉPASSEMENT non. Une machine étrangère
 * ne pouvait donc pas signaler un plafond trop haut — ce qui ne coûte qu'une
 * occasion manquée — mais pouvait REFUSER la page sur un plafond qui n'est pas le
 * sien, ce qui s'annonce comme une dette à corriger. Le sens de l'asymétrie était
 * exactement le mauvais.
 *
 * ═══ CE QUE CE FICHIER GARDE, ET POURQUOI PAR LA SOURCE ═══
 *
 * Ces portes ouvrent un navigateur et servent un paquet construit : aucun cas de
 * `vitest` ne peut les exécuter. Ce qu'un cas PEUT tenir, c'est leur SOURCE — le
 * dépôt le fait déjà ainsi pour ce que le serveur et le client doivent garder
 * d'accord (`dureeDuLien`, `confidentialite`). On tient donc les deux
 * propriétés qui ont manqué : la colonne se MESURE, et les deux comparaisons
 * sont gardées par la MÊME condition.
 */

const PORTES = [
  ['plafond-vitrine', VITRINE],
  ['plafond-hauteurs', HAUTEURS],
] as const

describe('la colonne des plafonds', () => {
  it('ne suppose plus que cette machine possède la colonne normale', () => {
    for (const [nom, source] of PORTES) {
      /* LA CONSTANTE, ET NON LA LIGNE : la ligne fautive est CITÉE dans les
         commentaires des deux portes — c'est ainsi qu'on garde la trace d'un
         défaut — et la chercher en toutes lettres ferait rougir ce cas sur sa
         propre documentation. Ce qui ne doit plus exister est la DÉCISION prise
         une fois pour toutes au chargement du module. */
      expect(source, `${nom} : la colonne se décide encore au chargement`).not.toMatch(
        /const COLONNE_A_NOUS\s*=/,
      )
      expect(source, `${nom} : la colonne n’est pas mesurée`).toMatch(
        /laColonneNormalePeutEtreANous/,
      )
      expect(source, `${nom} : le témoin n’est pas relevé`).toMatch(/releverLeTemoin/)
    }
  })

  it('ne juge plus un dépassement sur une colonne qui n’est pas la sienne', () => {
    for (const [nom, source] of PORTES) {
      /*
        DEUX QUESTIONS, DEUX CONDITIONS — et ma première rédaction les avait
        confondues, ce qui aurait coûté la seule enforcement disponible en local.

        LE MOU (« le plafond est au-dessus de la mesure ») ne vaut que sur la
        machine qui POSSÈDE la colonne : ailleurs, l'écart n'est pas du mou, c'est
        une différence de police.

        LE DÉPASSEMENT vaut dès que la colonne mesurée est celle de la passe : une
        croissance de CONTENU se voit dans les DEUX passes. Il reste donc jugé en
        police large même hors `CI` — c'est la seule colonne qu'une machine autre
        que celle de développement reproduise. Ce qui disparaît est le seul
        verdict qu'aucune mesure ne soutenait : le dépassement de la colonne
        NORMALE sur une machine dont `system-ui` n'est pas celui de la colonne.
      */
      const mou = /if \((\w+) && plafond > (?:m\.)?hDoc\)/.exec(source)
      expect(mou, `${nom} : la garde du mou a changé de forme`).not.toBeNull()

      const exces = /if \((\w+) && (?:m\.)?hDoc > plafond\)/.exec(source)
      expect(exces, `${nom} : le dépassement n’est gardé par rien`).not.toBeNull()

      /* LES DEUX GARDES SONT DISTINCTES, et c'est le point : les confondre rend
         soit un faux rouge (la première rédaction du défaut), soit un silence
         complet (la première rédaction de son correctif). */
      expect(
        exces![1],
        `${nom} : le dépassement et le mou partagent leur garde`,
      ).not.toBe(mou![1])

      /* ET LA GARDE DU DÉPASSEMENT SUIT CELLE DU MOU EN POLICE NORMALE : c'est là,
         et seulement là, que la machine peut ne pas posséder la colonne mesurée. */
      expect(source, `${nom} : la garde du dépassement ne suit pas le témoin`).toMatch(
        new RegExp(`${exces![1]}\\s*=\\s*${mou![1]}`),
      )
    }
  })

  it('dit la colonne jugée, au vert comme au rouge', () => {
    for (const [nom, source] of PORTES) {
      /* UN VERT OBTENU SUR UNE COLONNE ÉTRANGÈRE N'EST PAS UNE ASSURANCE, et
         c'est ce silence qui a laissé prendre un relevé pour un verdict : la
         ligne n'était imprimée qu'au rouge, et `plafond-vitrine` ne l'imprimait
         pas du tout. */
      expect(source, `${nom} : la colonne jugée n’est pas dite`).toMatch(/NON JUGÉE/)
      expect(source, `${nom} : le remède n’est pas donné`).toMatch(/MESURER_EN_POLICE_LARGE=1/)
    }
  })

  it('mesure le témoin sans inscrire aucun empan', () => {
    /* UNE LARGEUR GRAVÉE DANS UNE SOURCE VIEILLIT À LA PREMIÈRE VERSION DE
       POLICE, et ce dépôt a déjà vu ce genre de nombre pourrir. Deux mesures
       prises dans la MÊME exécution se comparent sans référence extérieure : on
       vérifie donc qu'aucun empan en pixels ne serve de seuil — seule la
       tolérance d'arrondi est un nombre, et elle est sous le pixel. */
    const seuils = TEMOIN.match(/<\s*(\d+(?:\.\d+)?)/g) ?? []
    for (const seuil of seuils) {
      const valeur = Number(seuil.replace('<', '').trim())
      expect(valeur, `un empan de ${valeur} px sert de seuil`).toBeLessThan(1)
    }
    expect(TEMOIN, 'le témoin ne compare plus system-ui au repli').toMatch(/system-ui/)
    expect(TEMOIN).toMatch(/DejaVu Sans/)
  })
})
