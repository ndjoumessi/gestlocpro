/**
 * UN NUMÉRO CAMEROUNAIS, ÉCRIT COMME LA DÉMONSTRATION L'ÉCRIT.
 *
 * Le serveur rend l'E.164 brut — « +237677111111 » —, que personne ne relit ni
 * ne dicte sans compter les chiffres du doigt. La démonstration écrit
 * « +237 6 77 21 44 08 » depuis toujours : un parc réel affichait donc ses
 * numéros autrement que la démo qui le présente.
 *
 * SEUL LE +237 EST GROUPÉ, parce que c'est le seul découpage que ce dépôt
 * pratique déjà. Chaque pays groupe à sa façon ; un découpage inventé se lit
 * comme un numéro faux. Tout le reste est rendu tel qu'il est venu.
 *
 * L'AFFICHAGE SEULEMENT. Le lien `tel:` et la saisie gardent le numéro
 * enregistré : grouper n'est pas corriger.
 */
export function telephoneLisible(numero: string): string {
  const chiffres = numero.replace(/\s/g, '')
  const camerounais = /^\+237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(chiffres)
  return camerounais ? `+237 ${camerounais.slice(1).join(' ')}` : numero
}
