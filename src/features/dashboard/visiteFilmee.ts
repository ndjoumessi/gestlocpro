import { LOCALES, type Locale } from '@/i18n/locales'

/**
 * LA VISITE FILMÉE, UNE PAR LANGUE.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══
 *
 * Il n'a pas toujours existé. La visite était une CONSTANTE DE MODULE dans
 * `Manuel.tsx` — un seul `.mp4`, tourné en français, servi à tout le monde.
 * L'habillage traduisait, le film non : un visiteur anglophone lisait « the
 * screens you will get » et regardait soixante-dix secondes de « Vue consolidée
 * du parc » et de « 447 000 FCFA à percevoir ». Mesuré le 2026-10-01, sur le
 * paquet de cet arbre, dans deux contextes de navigateur : `<html lang>` basculait
 * à `en`, les trois titres basculaient, et `<video src>` ne bougeait pas.
 *
 * La langue d'un film ne se lit NULLE PART dans le film : pas de type, pas de
 * compilateur, pas de porte. C'est pourquoi elle se lit désormais dans son NOM,
 * et pourquoi le français a été renommé en même temps que l'anglais est né —
 * `visite-du-produit.mp4` ne disait pas qu'il était français.
 *
 * ═══ CE QUE `Record<Locale, …>` TIENT, ET QU'AUCUN CAS NE REFAIT ═══
 *
 * Une troisième langue ajoutée à `LOCALES` fait échouer la COMPILATION ici,
 * avant toute exécution. C'est la garde la moins chère du lot : elle n'a ni
 * fichier, ni temps d'exécution, et elle ne peut pas être oubliée. Ce que `tsc`
 * ne voit pas est tenu ailleurs, et les deux lisent CETTE liste :
 *
 *  - que les fichiers existent dans `public/`, et qu'aucun n'y traîne sans être
 *    nommé — `manuelSansLienMort.test.tsx`, dans `check:rapide` ;
 *  - que l'HÔTE les serve en vidéo ou en image, et non la coquille de
 *    l'application derrière un 200 — la porte de fumée, tous les jours.
 *
 * ═══ CE QUI N'EST GARDÉ PAR PERSONNE, ET QUI EST AVOUÉ ═══
 *
 * Qu'un film DÉCRIVE ENCORE LE PRODUIT. Aucune porte ne sait lire ce qui est
 * peint dans un MP4 : le jour où un écran change, les deux visites vieillissent
 * en silence, exactement comme le faisait la base des poids avant son empreinte.
 * La réponse n'est pas une garde, c'est un script qui se RELANCE —
 * `npm run visite` refilme les deux langues d'un coup, et c'est précisément
 * pour qu'aucune des deux ne puisse être refaite seule qu'il les tourne
 * ensemble. Même famille que l'absence de sous-titres, dite dans `Manuel.tsx` :
 * un manque nommé, pas un manque ignoré.
 */
export type Visite = {
  /** Le film, servi depuis `public/`. Son nom porte sa langue. */
  readonly video: string
  /**
   * L'AFFICHE, et elle n'est pas décorative : `preload="metadata"` ne peint
   * rien, donc sans elle le lecteur est un rectangle gris sous un titre qui
   * promet une visite. Elle est tirée du film qu'elle annonce — une affiche
   * française au-dessus d'un film anglais serait le défaut d'origine en plus
   * petit.
   */
  readonly affiche: string
}

export const VISITES: Record<Locale, Visite> = {
  fr: { video: '/visite-du-produit.fr.mp4', affiche: '/visite-affiche.fr.jpg' },
  en: { video: '/visite-du-produit.en.mp4', affiche: '/visite-affiche.en.jpg' },
}

/** Les chemins servis, à plat : ce que les gardes ont à trouver dans `public/`. */
export const FICHIERS_DE_VISITE = LOCALES.flatMap((l) => [VISITES[l].video, VISITES[l].affiche])
