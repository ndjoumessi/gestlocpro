/**
 * LE DÉLAI AVANT EFFACEMENT, côté écran.
 *
 * Le serveur porte le même nombre dans `server/src/auth/fermeture.ts`, et c'est
 * LUI qui fait foi : la date rendue par la route est celle qu'on affiche. Ce
 * nombre-ci ne sert qu'à ANNONCER le délai avant de le demander — « tout sera
 * effacé trente jours plus tard ». Les deux projets ne partagent pas de module ;
 * la règle est écrite deux fois, comme les décimales des devises, et un cas la
 * tient des deux côtés.
 */
export const DELAI_D_EFFACEMENT_JOURS = 30
