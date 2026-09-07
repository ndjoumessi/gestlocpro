/**
 * LES DEUX PREMIÈRES INITIALES D'UN NOM — la pastille d'identité d'une fiche.
 *
 * Partagée depuis que DEUX écrans rendent des personnes en fiches : les
 * locataires et le registre des accès. Elle vivait dans `Tenants`, et le
 * second écran l'aurait recopiée — une troisième copie, après celle
 * d'`AppShell`, qui elle garde sa signature non nullable parce que la barre
 * d'application a toujours un nom à peindre.
 *
 * `?? ''` plutôt qu'un appelant prudent : un membre sans nom existe en base —
 * une invitation acceptée avant que le compte ne soit nommé — et deux écrans
 * qui se protègent chacun de leur côté finissent par ne plus se protéger.
 */
export function initiales(nom: string | null): string {
  return (nom ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}
